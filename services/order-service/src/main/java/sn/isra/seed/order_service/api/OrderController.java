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
import sn.isra.seed.order_service.repo.LotReceptionRepo;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.StockOrderRepo;
import sn.isra.seed.order_service.repo.TransfertLotOrderRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import sn.isra.seed.order_service.entity.MembreOrganisation;

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
  private final LotReceptionRepo lotReceptionRepo;
  private final TransfertLotOrderRepo transfertLotOrderRepo;
  private final sn.isra.seed.order_service.repo.GenerationSemenceRepo generationRepo;
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
  public Page<Commande> list(
      @AuthenticationPrincipal Jwt jwt,
      @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
    if (jwt != null && isMultiplicateur(jwt)) {
      String username = jwt.getClaimAsString("preferred_username");
      return membreRepo.findByKeycloakUsername(username)
          .map(m -> commandeRepo.findByIdOrganisationFournisseurOrderByCreatedAtDesc(
              m.getOrganisation().getId(), pageable))
          .orElse(Page.empty(pageable));
    }
    return commandeRepo.findAll(pageable);
  }

  private boolean isMultiplicateur(Jwt jwt) {
    return hasRole(jwt, "seed-multiplicator");
  }

  private boolean isUpsemcl(Jwt jwt) {
    return hasRole(jwt, "seed-upsemcl");
  }

  private boolean isQuotaire(Jwt jwt) {
    return hasRole(jwt, "seed-quotataire");
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
  public Page<Commande> mesCommandes(
      @AuthenticationPrincipal Jwt jwt,
      @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
    String username = jwt.getClaimAsString("preferred_username");
    return commandeRepo.findByUsernameAcheteurOrderByCreatedAtDesc(username, pageable);
  }

  /**
   * GET /api/orders/mes-demandes-g3
   * Commandes de G3 passées PAR le multiplicateur connecté auprès de l'UPSemCL.
   * Isolation stricte par usernameAcheteur : chaque multiplicateur ne voit que SES propres
   * demandes, même s'il partage un org avec un autre agent.
   */
  @GetMapping("/mes-demandes-g3")
  public List<Commande> mesDemandesG3(@AuthenticationPrincipal Jwt jwt) {
    String username = jwt.getClaimAsString("preferred_username");
    return commandeRepo.findByUsernameAcheteurOrderByCreatedAtDesc(username);
  }

  /**
   * Commandes reçues par l'organisation connectée.
   * Pour l'UPSemCL : toutes les commandes dont le fournisseur est de type UPSEMCL
   * (quel que soit l'ID d'org), plus celles sans fournisseur explicite.
   */
  @GetMapping("/a-traiter")
  public Page<Commande> aTraiter(
      @AuthenticationPrincipal Jwt jwt,
      @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
    if (isUpsemcl(jwt)) {
      return commandeRepo.findForAnyUpsemcl(pageable);
    }
    String username = jwt.getClaimAsString("preferred_username");
    return membreRepo.findByKeycloakUsername(username)
        .map(m -> commandeRepo.findByIdOrganisationFournisseurOrderByCreatedAtDesc(
            m.getOrganisation().getId(), pageable))
        .orElse(Page.empty(pageable));
  }

  @Transactional
  @PostMapping
  public Commande create(@Valid @RequestBody CreateOrderRequest req,
                         @AuthenticationPrincipal Jwt jwt) throws Exception {
    String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
    Optional<MembreOrganisation> membre = username != null
        ? membreRepo.findByKeycloakUsername(username)
        : Optional.empty();
    Long orgAcheteur = membre.map(m -> m.getOrganisation().getId()).orElse(null);

    String localisationAcheteur = membre.map(m -> {
      String loc = m.getOrganisation().getLocalite();
      String reg = m.getOrganisation().getRegion();
      if (loc != null && reg != null) return loc + ", " + reg;
      return loc != null ? loc : reg;
    }).orElse(null);

    Commande c = new Commande();
    c.setCodeCommande(req.codeCommande());
    c.setClient(req.client());
    c.setStatut(StatutCommande.SOUMISE);
    c.setUsernameAcheteur(username);
    c.setIdOrganisationAcheteur(orgAcheteur);
    c.setNomCompletAcheteur(membre.map(m -> m.getNomComplet()).orElse(null));
    c.setNomOrganisationAcheteur(membre.map(m -> m.getOrganisation().getNomOrganisation()).orElse(null));
    c.setLocalisationAcheteur(localisationAcheteur);
    c.setIdOrganisationFournisseur(req.idOrganisationFournisseur());
    c.setObservations(req.observations());
    c.setCreatedAt(Instant.now());
    Commande saved = commandeRepo.save(c);

    if (req.lignes() != null) {
      if (isQuotaire(jwt)) {
        boolean allR2 = req.lignes().stream()
            .allMatch(l -> l.idGeneration() != null && l.idGeneration() == 7L);
        if (!allR2) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
            "Les quotataires ne peuvent commander que des semences R2 (commerciales)");
      }
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
        if (l.idGeneration() != null) {
          generationRepo.findById(l.idGeneration()).ifPresent(lc::setGeneration);
        }
        lc.setQuantiteDemandee(l.quantite());
        lc.setUnite(l.unite() == null ? "kg" : l.unite());
        ligneRepo.save(lc);
      }
    }

    producer.orderCreated(om.writeValueAsString(saved));
    return saved;
  }

  /** Changer le statut d'une commande. Déclenche un mouvement de stock sur LIVREE. */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
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
   * Débite le stock UPSemCL et crée un lot de réception (REC) pour le multiplicateur acheteur.
   * Le lot REC reçoit son propre stock crédité et un transfert_lot ACCEPTE pointant sur lui.
   * Ainsi le lot est visible dans "Mes Lots" (idOrgProducteur = org multiplicateur)
   * et dans le stock agrégé du multiplicateur, sans pollution par les lots UPSemCL.
   */
  private void appliquerMouvementStock(Commande commande, String emetteur) {
    if (commande.getIdOrganisationAcheteur() == null || commande.getUsernameAcheteur() == null) {
      log.warn("appliquerMouvementStock ignoré : org ou username acheteur absent — commande #{}", commande.getId());
      return;
    }
    for (LigneCommande ligne : commande.getLignes()) {
      List<AllocationCommande> allocs = allocationRepo.findByLigne_Id(ligne.getId());
      for (AllocationCommande alloc : allocs) {
        try {
          // 1. Débiter le stock UPSemCL (lot source)
          stockOrderRepo.debitUpsemcl(alloc.getIdLot(), alloc.getQuantiteAllouee());

          // 2. Créer un lot REC pour le multiplicateur (enfant du lot UPSemCL)
          String unite = ligne.getUnite() != null ? ligne.getUnite() : "kg";
          String codeLotRec = "REC-" + commande.getId() + "-ALLOC-" + alloc.getId();
          Long newLotId = lotReceptionRepo.createReceptionLot(
              alloc.getIdLot(), codeLotRec,
              commande.getIdOrganisationAcheteur(),
              commande.getUsernameAcheteur(),
              alloc.getQuantiteAllouee(), unite
          );

          // 3. Créditer le stock du lot REC au site principal du multiplicateur
          stockOrderRepo.creditOrg(newLotId, commande.getIdOrganisationAcheteur(),
              alloc.getQuantiteAllouee(), unite);

          // 4. Débiter la quantite_nette du lot UPSemCL source
          lotQuantiteRepo.debitLotUpsemcl(
              ligne.getIdVariete(), ligne.getIdGeneration(), alloc.getQuantiteAllouee());

          // 5. Transfert_lot ACCEPTE pointant sur le lot REC (pas sur le lot UPSemCL)
          String codeTransfert = "AUTO-TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
          transfertLotOrderRepo.createAutoTransfert(
              codeTransfert, newLotId, emetteur,
              commande.getUsernameAcheteur(), alloc.getQuantiteAllouee()
          );

          log.info("Livraison (updateStatut) : lot REC {} créé pour org {} à partir du lot UPSemCL {}",
              codeLotRec, commande.getIdOrganisationAcheteur(), alloc.getIdLot());
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-admin')")
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-admin')")
  @Transactional
  @PatchMapping("/{id}/accepter-proposition")
  public ResponseEntity<Commande> accepterProposition(
      @PathVariable Long id,
      @RequestBody(required = false) java.util.Map<String, Object> body) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_NEGOCIATION pour accepter la proposition (statut actuel : " + commande.getStatut() + ")");
    }

    if (body != null && body.get("siteCode") instanceof String sc && !sc.isBlank()) {
      commande.setSiteDestinationCode(sc);
    }

    commande.setStatut(StatutCommande.ACCORDEE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/refuser-proposition  (Multiplicateur)
   * Le multiplicateur refuse la proposition — effacement des propositions, retour à SOUMISE.
   * Pré-condition : commande EN_NEGOCIATION.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-admin')")
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-admin')")
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
    // Code de base stocké sur la commande ; chaque ligne reçoit un code unique suffixé "-L{id}"
    String baseCode = "TL-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();

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

      // Débiter le stock du fournisseur (multiplicateur ou UPSemCL selon idOrganisationFournisseur)
      if (commande.getIdOrganisationFournisseur() != null) {
        stockOrderRepo.debitByOrg(ligne.getIdLotPropose(),
            commande.getIdOrganisationFournisseur(), ligne.getQuantiteProposee());
      } else {
        stockOrderRepo.debitUpsemcl(ligne.getIdLotPropose(), ligne.getQuantiteProposee());
      }

      // Code unique par ligne pour respecter UNIQUE(code_transfert)
      String codeLigne = baseCode + "-L" + ligne.getId();
      transfertLotOrderRepo.createPendingTransfert(
          codeLigne,
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
    commande.setCodeTransfertGenere(baseCode);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/accuser-reception  (Multiplicateur)
   * Le multiplicateur confirme avoir reçu les semences.
   * Crédite son stock, valide le transfert (→ ACCEPTE), passe la commande en LIVREE.
   * Pré-condition : commande EN_LIVRAISON.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-admin')")
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

    String siteDestCode = commande.getSiteDestinationCode();

    for (LigneCommande ligne : commande.getLignes()) {
      if (ligne.getIdLotPropose() == null || ligne.getQuantiteProposee() == null) continue;

      String unite = ligne.getUnite() != null ? ligne.getUnite() : "kg";

      // Créer un nouveau lot_semencier au nom du multiplicateur (enfant du lot UPSemCL)
      String codeLot = "REC-" + commande.getId() + "-L" + ligne.getId();
      Long newLotId = lotReceptionRepo.createReceptionLot(
          ligne.getIdLotPropose(), codeLot,
          commande.getIdOrganisationAcheteur(),
          commande.getUsernameAcheteur(),
          ligne.getQuantiteProposee(), unite
      );

      // Créditer le stock du NOUVEAU lot au site choisi par le multiplicateur
      if (siteDestCode != null && !siteDestCode.isBlank()) {
        stockOrderRepo.creditSiteCode(newLotId, siteDestCode, ligne.getQuantiteProposee(), unite);
      } else {
        stockOrderRepo.creditOrg(newLotId, commande.getIdOrganisationAcheteur(), ligne.getQuantiteProposee(), unite);
      }

      // Rediriger le transfert EN_ATTENTE vers le lot REC avant de l'accepter :
      // sans cette redirection, le lot UPSemCL source resterait visible dans "Mes Lots"
      // du multiplicateur via la condition transfert_lot ACCEPTE de findMesLots.
      if (commande.getCodeTransfertGenere() != null) {
        transfertLotOrderRepo.updateTransfertIdLot(
            commande.getCodeTransfertGenere(), ligne.getIdLotPropose(), newLotId);
      }
    }

    // Valider le transfert_lot redirigé (EN_ATTENTE → ACCEPTE, pointe maintenant sur le lot REC)
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-admin')")
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

      // 2c. Créer un lot de réception pour le multiplicateur + créditer son site principal
      String uniteItem = ligne.getUnite() != null ? ligne.getUnite() : "kg";
      // Inclut idLot pour unicité quand plusieurs lots couvrent la même ligne (FIFO multi-lot)
      String codeLotRec = "REC-" + commande.getId() + "-L" + item.idLigne() + "-" + item.idLot();
      Long newLotId = lotReceptionRepo.createReceptionLot(
          item.idLot(), codeLotRec,
          commande.getIdOrganisationAcheteur(),
          commande.getUsernameAcheteur(),
          item.quantite(), uniteItem
      );
      stockOrderRepo.creditOrg(newLotId, commande.getIdOrganisationAcheteur(), item.quantite(), uniteItem);

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

      // 2e. Créer le transfert_lot automatique (statut ACCEPTE) pointant sur le lot REC :
      //     on lie le transfert au nouveau lot (idOrgProducteur = multiplicateur) et non
      //     au lot UPSemCL source, pour éviter qu'il n'apparaisse dans "Mes Lots" du multi.
      String codeTransfert = "AUTO-TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
      transfertLotOrderRepo.createAutoTransfert(
          codeTransfert,
          newLotId,
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
