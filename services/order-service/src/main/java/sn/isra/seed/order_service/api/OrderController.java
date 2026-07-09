package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.api.dto.AllocateRequest;
import sn.isra.seed.order_service.api.dto.CreateOrderRequest;
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

      // 2d. Débiter la quantité nette du lot source dans lot_semencier
      int updated = lotQuantiteRepo.debitLotById(item.idLot(), item.quantite());
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Quantité insuffisante sur le lot #" + item.idLot()
            + " — vérifiez le stock disponible avant de valider");
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
