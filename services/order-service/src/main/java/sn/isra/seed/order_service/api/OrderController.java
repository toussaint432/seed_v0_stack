package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.api.dto.AllocateRequest;
import sn.isra.seed.order_service.api.dto.CreateOrderRequest;
import sn.isra.seed.order_service.api.dto.ProposeRequest;
import sn.isra.seed.order_service.api.dto.StatutRequest;
import sn.isra.seed.order_service.api.dto.ValiderCommandeRequest;
import sn.isra.seed.order_service.entity.AllocationCommande;
import sn.isra.seed.order_service.entity.Commande;
import sn.isra.seed.order_service.entity.LigneCommande;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.kafka.OrderEventProducer;
import sn.isra.seed.order_service.repo.AllocationRepo;
import sn.isra.seed.order_service.repo.CommandeRepo;
import sn.isra.seed.order_service.repo.LigneRepo;
import sn.isra.seed.order_service.repo.LotQuantiteRepo;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.StockOrderRepo;
import sn.isra.seed.order_service.repo.TransfertLotOrderRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

  private final CommandeRepo commandeRepo;
  private final LigneRepo ligneRepo;
  private final AllocationRepo allocationRepo;
  private final MembreOrganisationRepo membreRepo;
  private final StockOrderRepo stockOrderRepo;
  private final LotQuantiteRepo lotQuantiteRepo;
  private final TransfertLotOrderRepo transfertLotOrderRepo;
  private final OrderEventProducer producer;
  private final ObjectMapper om;

  /** Détail d'une commande par ID */
  @GetMapping("/{id}")
  public ResponseEntity<Commande> getById(@PathVariable Long id) {
    return commandeRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /** Toutes les commandes (admin / upsemcl) — multiplicateur redirigé vers ses commandes reçues */
  @GetMapping
  public List<Commande> list(@AuthenticationPrincipal Jwt jwt) {
    if (jwt != null && isMultiplicateur(jwt)) {
      String username = jwt.getClaimAsString("preferred_username");
      return membreRepo.findByKeycloakUsername(username)
          .map(m -> commandeRepo.findByIdOrganisationFournisseurOrderByCreatedAtDesc(m.getOrganisation().getId()))
          .orElse(List.of());
    }
    return commandeRepo.findAll();
  }

  private boolean isMultiplicateur(Jwt jwt) {
    return hasRole(jwt, "seed-multiplicator");
  }

  private boolean isUpsemcl(Jwt jwt) {
    return hasRole(jwt, "seed-upsemcl");
  }

  private boolean hasRole(Jwt jwt, String role) {
    try {
      java.util.Map<String, Object> ra = jwt.getClaim("realm_access");
      if (ra == null) return false;
      Object roles = ra.get("roles");
      if (roles instanceof java.util.List<?> list) return list.contains(role);
    } catch (Exception ignored) {}
    return false;
  }

  /** Commandes passées par le quotataire connecté */
  @GetMapping("/mes-commandes")
  public List<Commande> mesCommandes(@AuthenticationPrincipal Jwt jwt) {
    String username = jwt.getClaimAsString("preferred_username");
    return commandeRepo.findByUsernameAcheteurOrderByCreatedAtDesc(username);
  }

  /**
   * GET /api/orders/mes-demandes-g3
   * Commandes de G3 passées PAR le multiplicateur connecté auprès de l'UPSemCL.
   * Isolation : filtre sur id_organisation_acheteur = org du connecté.
   */
  @GetMapping("/mes-demandes-g3")
  public List<Commande> mesDemandesG3(@AuthenticationPrincipal Jwt jwt) {
    String username = jwt.getClaimAsString("preferred_username");
    return membreRepo.findByKeycloakUsername(username)
        .map(m -> commandeRepo.findByIdOrganisationAcheteurOrderByCreatedAtDesc(
            m.getOrganisation().getId()))
        .orElse(List.of());
  }

  /**
   * Commandes reçues par l'organisation connectée.
   * Pour l'UPSemCL : toutes les commandes dont le fournisseur est de type UPSEMCL
   * (quel que soit l'ID d'org), plus celles sans fournisseur explicite.
   */
  @GetMapping("/a-traiter")
  public List<Commande> aTraiter(@AuthenticationPrincipal Jwt jwt) {
    if (isUpsemcl(jwt)) {
      return commandeRepo.findForAnyUpsemcl();
    }
    String username = jwt.getClaimAsString("preferred_username");
    return membreRepo.findByKeycloakUsername(username)
        .map(m -> commandeRepo.findByIdOrganisationFournisseurOrderByCreatedAtDesc(m.getOrganisation().getId()))
        .orElse(List.of());
  }

  @Transactional
  @PostMapping
  public Commande create(@Valid @RequestBody CreateOrderRequest req,
                         @AuthenticationPrincipal Jwt jwt) throws Exception {
    String username   = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
    Long orgAcheteur  = null;
    if (username != null) {
      orgAcheteur = membreRepo.findByKeycloakUsername(username)
          .map(m -> m.getOrganisation().getId()).orElse(null);
    }

    Commande c = new Commande();
    c.setCodeCommande(req.codeCommande());
    c.setClient(req.client());
    c.setStatut(StatutCommande.SOUMISE);
    c.setUsernameAcheteur(username);
    c.setIdOrganisationAcheteur(orgAcheteur);
    c.setIdOrganisationFournisseur(req.idOrganisationFournisseur());
    c.setObservations(req.observations());
    c.setCreatedAt(Instant.now());
    Commande saved = commandeRepo.save(c);

    if (req.lignes() != null) {
      for (CreateOrderRequest.Line l : req.lignes()) {
        java.math.BigDecimal dispo;
        // R1 (id=6) et R2 (id=7) : lots détenus par multiplicateurs → table stock
        if (l.idGeneration() != null && (l.idGeneration() == 6L || l.idGeneration() == 7L)) {
          dispo = stockOrderRepo.sumDisponibleR1R2(l.idVariete(), l.idGeneration());
        } else {
          // G1-G3 : lots UPSemCL → table lot_semencier.quantite_nette
          dispo = lotQuantiteRepo.sumDisponibleUpsemcl(l.idVariete(), l.idGeneration());
        }
        if (dispo == null) dispo = java.math.BigDecimal.ZERO;
        if (dispo.compareTo(l.quantite()) < 0) {
          throw new ResponseStatusException(HttpStatus.CONFLICT,
              "Quantité insuffisante pour la variété #" + l.idVariete()
              + " — disponible : " + dispo.toPlainString() + " kg");
        }
      }
      for (CreateOrderRequest.Line l : req.lignes()) {
        LigneCommande lc = new LigneCommande();
        lc.setCommande(saved);
        lc.setIdVariete(l.idVariete());
        lc.setIdGeneration(l.idGeneration());
        lc.setQuantiteDemandee(l.quantite());
        lc.setUnite(l.unite() == null ? "kg" : l.unite());
        ligneRepo.save(lc);
      }
    }

    producer.orderCreated(om.writeValueAsString(saved));
    return saved;
  }

  /** Changer le statut d'une commande. Déclenche un mouvement de stock sur LIVREE. */
  @Transactional
  @PutMapping("/{id}/statut")
  public ResponseEntity<Commande> updateStatut(@PathVariable Long id,
                                               @Valid @RequestBody StatutRequest req,
                                               @AuthenticationPrincipal Jwt jwt) {
    if (req.statut() == null || req.statut().isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'statut' est obligatoire");

    StatutCommande nouveauStatut;
    try {
      nouveauStatut = StatutCommande.valueOf(req.statut().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Statut invalide : " + req.statut() +
          ". Valeurs acceptées : SOUMISE, ACCEPTEE, EN_PREPARATION, LIVREE, ANNULEE, REJETEE");
    }

    return commandeRepo.findById(id).map(c -> {
      c.setStatut(nouveauStatut);
      if (req.observations() != null) c.setObservations(req.observations());
      Commande saved = commandeRepo.save(c);

      if (nouveauStatut == StatutCommande.LIVREE && c.getIdOrganisationAcheteur() != null) {
        String emetteur = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";
        appliquerMouvementStock(saved, emetteur);
      }

      return ResponseEntity.ok(saved);
    }).orElse(ResponseEntity.notFound().build());
  }

  /**
   * Débite le stock UPSemCL et crédite le stock du multiplicateur acheteur
   * pour chaque allocation liée à la commande.
   * Crée également un transfert_lot automatique (statut ACCEPTE) pour chaque allocation.
   */
  private void appliquerMouvementStock(Commande commande, String emetteur) {
    for (LigneCommande ligne : commande.getLignes()) {
      List<AllocationCommande> allocs = allocationRepo.findByLigne_Id(ligne.getId());
      for (AllocationCommande alloc : allocs) {
        try {
          stockOrderRepo.debitUpsemcl(alloc.getIdLot(), alloc.getQuantiteAllouee());
          stockOrderRepo.creditOrg(
              alloc.getIdLot(),
              commande.getIdOrganisationAcheteur(),
              alloc.getQuantiteAllouee(),
              ligne.getUnite() != null ? ligne.getUnite() : "kg"
          );
          // Débiter la quantite_nette du lot semencier source
          lotQuantiteRepo.debitLotUpsemcl(
              ligne.getIdVariete(), ligne.getIdGeneration(), alloc.getQuantiteAllouee());
          // Créer le transfert_lot automatique
          String codeTransfert = "AUTO-TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
          transfertLotOrderRepo.createAutoTransfert(
              codeTransfert,
              alloc.getIdLot(),
              emetteur,
              commande.getUsernameAcheteur(),
              alloc.getQuantiteAllouee()
          );
        } catch (Exception e) {
          log.error("Mouvement stock échoué — lot={} org={}: {}",
              alloc.getIdLot(), commande.getIdOrganisationAcheteur(), e.getMessage());
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     WORKFLOW NÉGOCIATION UPSemCL ↔ MULTIPLICATEUR
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * PATCH /api/orders/{id}/proposer  (UPSemCL)
   * L'agent UPSemCL propose un lot et une quantité pour chaque ligne.
   * Pré-condition : commande SOUMISE ou déjà EN_NEGOCIATION (re-proposition autorisée).
   */
  @Transactional
  @PatchMapping("/{id}/proposer")
  public ResponseEntity<Commande> proposer(
      @PathVariable Long id,
      @Valid @RequestBody ProposeRequest req,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.SOUMISE && commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seule une commande SOUMISE ou EN_NEGOCIATION peut recevoir une proposition (statut actuel : " + commande.getStatut() + ")");
    }

    for (ProposeRequest.PropositionItem item : req.propositions()) {
      LigneCommande ligne = ligneRepo.findById(item.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne #" + item.idLigne() + " introuvable"));
      if (!ligne.getCommande().getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La ligne #" + item.idLigne() + " n'appartient pas à cette commande");
      }
      ligne.setQuantiteProposee(item.quantiteProposee());
      ligne.setIdLotPropose(item.idLot());
      ligneRepo.save(ligne);
    }

    commande.setStatut(StatutCommande.EN_NEGOCIATION);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/accepter-proposition  (Multiplicateur)
   * Le multiplicateur accepte la proposition de l'UPSemCL.
   * Pré-condition : commande EN_NEGOCIATION.
   */
  @Transactional
  @PatchMapping("/{id}/accepter-proposition")
  public ResponseEntity<Commande> accepterProposition(@PathVariable Long id) {
    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_NEGOCIATION pour accepter la proposition (statut actuel : " + commande.getStatut() + ")");
    }

    commande.setStatut(StatutCommande.ACCORDEE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/refuser-proposition  (Multiplicateur)
   * Le multiplicateur refuse la proposition — effacement des propositions, retour à SOUMISE.
   * Pré-condition : commande EN_NEGOCIATION.
   */
  @Transactional
  @PatchMapping("/{id}/refuser-proposition")
  public ResponseEntity<Commande> refuserProposition(@PathVariable Long id) {
    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_NEGOCIATION pour refuser la proposition (statut actuel : " + commande.getStatut() + ")");
    }

    for (LigneCommande ligne : commande.getLignes()) {
      ligne.setQuantiteProposee(null);
      ligne.setIdLotPropose(null);
      ligneRepo.save(ligne);
    }

    commande.setStatut(StatutCommande.SOUMISE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * POST /api/orders/{id}/faire-transfert  (UPSemCL)
   * Déclenche la livraison physique : débite le lot UPSemCL, crée un transfert_lot EN_ATTENTE.
   * Pré-condition : commande ACCORDEE.
   */
  @Transactional
  @PostMapping("/{id}/faire-transfert")
  public ResponseEntity<Commande> faireTransfert(
      @PathVariable Long id,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.ACCORDEE) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être ACCORDEE pour déclencher le transfert (statut actuel : " + commande.getStatut() + ")");
    }
    if (commande.getUsernameAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Acheteur non identifié — impossible de créer le transfert");
    }

    String emetteur = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";
    String codeTransfert = "TL-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();

    for (LigneCommande ligne : commande.getLignes()) {
      if (ligne.getIdLotPropose() == null || ligne.getQuantiteProposee() == null) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "La ligne #" + ligne.getId() + " n'a pas de proposition enregistrée — re-proposez avant de faire le transfert");
      }

      // Charger le lot avant débit pour l'historique et le calcul du nouveau statut
      var lot = lotQuantiteRepo.findById(ligne.getIdLotPropose())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
              "Lot #" + ligne.getIdLotPropose() + " introuvable"));
      String ancienStatut = lot.getStatutLot();

      // Débiter la quantité nette (+ statut → TRANSFERE si lot épuisé)
      int updated = lotQuantiteRepo.debitLotById(ligne.getIdLotPropose(), ligne.getQuantiteProposee());
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Quantité insuffisante sur le lot #" + ligne.getIdLotPropose());
      }

      // Enregistrer l'historique du transfert partiel
      java.math.BigDecimal restant = lot.getQuantiteNette().subtract(ligne.getQuantiteProposee());
      boolean epuise = restant.compareTo(java.math.BigDecimal.ZERO) <= 0;
      String nouveauStatut = epuise ? "TRANSFERE" : ancienStatut;
      String commentaire = "Transfert vers " + commande.getUsernameAcheteur()
          + " : " + ligne.getQuantiteProposee().toPlainString() + " kg transférés"
          + (epuise ? ", lot épuisé" : ", " + restant.toPlainString() + " kg restants");
      lotQuantiteRepo.insertHistoriqueTransfert(
          ligne.getIdLotPropose(), ancienStatut, nouveauStatut, emetteur, commentaire);

      // Débiter le stock UPSemCL
      stockOrderRepo.debitUpsemcl(ligne.getIdLotPropose(), ligne.getQuantiteProposee());

      // Créer le transfert_lot EN_ATTENTE (validé par l'accusé de réception du multiplicateur)
      transfertLotOrderRepo.createPendingTransfert(
          codeTransfert,
          ligne.getIdLotPropose(),
          emetteur,
          commande.getUsernameAcheteur(),
          ligne.getQuantiteProposee()
      );

      log.info("Transfert EN_ATTENTE créé : lot={} → {} ({} {}) — restant: {} kg",
          ligne.getIdLotPropose(), commande.getUsernameAcheteur(),
          ligne.getQuantiteProposee(), ligne.getUnite() != null ? ligne.getUnite() : "kg",
          epuise ? 0 : restant.toPlainString());
    }

    commande.setStatut(StatutCommande.EN_LIVRAISON);
    commande.setCodeTransfertGenere(codeTransfert);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/accuser-reception  (Multiplicateur)
   * Le multiplicateur confirme avoir reçu les semences.
   * Crédite son stock, valide le transfert (→ ACCEPTE), passe la commande en LIVREE.
   * Pré-condition : commande EN_LIVRAISON.
   */
  @Transactional
  @PatchMapping("/{id}/accuser-reception")
  public ResponseEntity<Commande> accuserReception(
      @PathVariable Long id,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_LIVRAISON) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_LIVRAISON pour accuser réception (statut actuel : " + commande.getStatut() + ")");
    }
    if (commande.getIdOrganisationAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation acheteur non renseignée — impossible de créditer le stock");
    }

    for (LigneCommande ligne : commande.getLignes()) {
      if (ligne.getIdLotPropose() == null || ligne.getQuantiteProposee() == null) continue;

      // Créditer le stock de l'organisation multiplicatrice
      stockOrderRepo.creditOrg(
          ligne.getIdLotPropose(),
          commande.getIdOrganisationAcheteur(),
          ligne.getQuantiteProposee(),
          ligne.getUnite() != null ? ligne.getUnite() : "kg"
      );
    }

    // Valider le transfert_lot (EN_ATTENTE → ACCEPTE)
    if (commande.getCodeTransfertGenere() != null) {
      transfertLotOrderRepo.accepterTransfert(commande.getCodeTransfertGenere());
    }

    commande.setStatut(StatutCommande.LIVREE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  @PostMapping("/allocate")
  public AllocationCommande allocate(@Valid @RequestBody AllocateRequest req) {
    LigneCommande ligne = ligneRepo.findById(req.idLigne()).orElseThrow();
    AllocationCommande a = new AllocationCommande();
    a.setLigne(ligne);
    a.setIdLot(req.idLot());
    a.setQuantiteAllouee(req.quantite());
    a.setCreatedAt(Instant.now());
    return allocationRepo.save(a);
  }

  /**
   * POST /api/orders/{id}/valider-et-livrer
   *
   * Action unifiée UPSemCL : valide ET livre une commande G3 en une seule requête.
   * L'agent sélectionne le lot G3 source et la quantité dans l'interface ;
   * ce endpoint crée l'allocation, débite le lot + le stock UPSemCL,
   * crédite le stock du multiplicateur, crée le transfert_lot (statut ACCEPTE)
   * et passe la commande à LIVREE — tout en une transaction atomique.
   *
   * Pré-condition : la commande doit être SOUMISE (pas encore acceptée).
   */
  @Transactional
  @PostMapping("/{id}/valider-et-livrer")
  public ResponseEntity<Commande> validerEtLivrer(
      @PathVariable Long id,
      @Valid @RequestBody ValiderCommandeRequest req,
      @AuthenticationPrincipal Jwt jwt) {

    // 1. Récupérer et vérifier la commande
    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
            "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.SOUMISE) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seule une commande SOUMISE peut être validée directement (statut actuel : "
          + commande.getStatut() + ")");
    }

    // Champs requis pour le transfert et le crédit de stock
    if (commande.getUsernameAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Acheteur non identifié sur cette commande — impossible de créer le transfert");
    }
    if (commande.getIdOrganisationAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Organisation acheteur non renseignée — impossible de créditer le stock");
    }

    String emetteur = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";

    // 2. Pour chaque allocation : enregistrement + mouvements de stock + transfert
    for (ValiderCommandeRequest.AllocationItem item : req.allocations()) {

      LigneCommande ligne = ligneRepo.findById(item.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
              "Ligne de commande #" + item.idLigne() + " introuvable"));

      // 2a. Créer l'enregistrement d'allocation (traçabilité)
      AllocationCommande alloc = new AllocationCommande();
      alloc.setLigne(ligne);
      alloc.setIdLot(item.idLot());
      alloc.setQuantiteAllouee(item.quantite());
      alloc.setCreatedAt(Instant.now());
      allocationRepo.save(alloc);

      // 2b. Débiter le stock UPSemCL (table stock) — no-op si pas encore d'entrée stock
      stockOrderRepo.debitUpsemcl(item.idLot(), item.quantite());

      // 2c. Créditer le stock du multiplicateur (table stock, INSERT ON CONFLICT UPDATE)
      stockOrderRepo.creditOrg(
          item.idLot(),
          commande.getIdOrganisationAcheteur(),
          item.quantite(),
          ligne.getUnite() != null ? ligne.getUnite() : "kg"
      );

      // 2d. Débiter la quantité nette du lot source (+ statut → TRANSFERE si épuisé)
      var lotSource = lotQuantiteRepo.findById(item.idLot()).orElse(null);
      String ancienStatutLot = lotSource != null ? lotSource.getStatutLot() : "DISPONIBLE";
      int updated = lotQuantiteRepo.debitLotById(item.idLot(), item.quantite());
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Quantité insuffisante sur le lot #" + item.idLot()
            + " — vérifiez le stock disponible avant de valider");
      }
      if (lotSource != null) {
        java.math.BigDecimal restantLot = lotSource.getQuantiteNette().subtract(item.quantite());
        boolean lotEpuise = restantLot.compareTo(java.math.BigDecimal.ZERO) <= 0;
        String nouveauStatutLot = lotEpuise ? "TRANSFERE" : ancienStatutLot;
        String commentaireLot = "Livraison directe vers " + commande.getUsernameAcheteur()
            + " : " + item.quantite().toPlainString() + " kg livrés"
            + (lotEpuise ? ", lot épuisé" : ", " + restantLot.toPlainString() + " kg restants");
        lotQuantiteRepo.insertHistoriqueTransfert(
            item.idLot(), ancienStatutLot, nouveauStatutLot, emetteur, commentaireLot);
      }

      // 2e. Créer le transfert_lot automatique (statut ACCEPTE) — visible immédiatement
      //     dans les lots du multiplicateur via findMesLots
      String codeTransfert = "AUTO-TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
      transfertLotOrderRepo.createAutoTransfert(
          codeTransfert,
          item.idLot(),
          emetteur,
          commande.getUsernameAcheteur(),
          item.quantite()
      );

      log.info("Transfert automatique créé : lot={} → {} ({}  {})",
          item.idLot(), commande.getUsernameAcheteur(), item.quantite(),
          ligne.getUnite() != null ? ligne.getUnite() : "kg");
    }

    // 3. Passer la commande en LIVREE
    commande.setStatut(StatutCommande.LIVREE);
    Commande saved = commandeRepo.save(commande);

    log.info("Commande {} livrée directement par {} — {} allocation(s)",
        commande.getCodeCommande(), emetteur, req.allocations().size());

    return ResponseEntity.ok(saved);
  }
}
