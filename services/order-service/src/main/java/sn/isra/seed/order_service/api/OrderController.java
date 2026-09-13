package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.api.dto.AllocateRequest;
import sn.isra.seed.order_service.api.dto.CreateOrderRequest;
import sn.isra.seed.order_service.api.dto.DecisionMultiplicateurRequest;
import sn.isra.seed.order_service.api.dto.DecisionQuotataireRequest;
import sn.isra.seed.order_service.api.dto.PropositionG3Request;
import sn.isra.seed.order_service.api.dto.PropositionR2Request;
import sn.isra.seed.order_service.api.dto.ProposeRequest;
import sn.isra.seed.order_service.api.dto.ReceptionConfirmationRequest;
import sn.isra.seed.order_service.api.dto.StatutRequest;
import sn.isra.seed.order_service.api.dto.ValiderCommandeRequest;
import sn.isra.seed.order_service.entity.enums.TypeCommande;
import sn.isra.seed.order_service.entity.AllocationCommande;
import sn.isra.seed.order_service.entity.Bordereau;
import sn.isra.seed.order_service.entity.Commande;
import sn.isra.seed.order_service.entity.LigneCommande;
import sn.isra.seed.order_service.entity.PropositionLigne;
import sn.isra.seed.order_service.entity.PropositionLotSource;
import sn.isra.seed.order_service.entity.ReceptionCommande;
import sn.isra.seed.order_service.entity.ReceptionEcart;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.entity.enums.StatutLigne;
import sn.isra.seed.order_service.kafka.OrderEventProducer;
import sn.isra.seed.order_service.repo.AllocationRepo;
import sn.isra.seed.order_service.repo.BordereauRepo;
import sn.isra.seed.order_service.repo.CommandeRepo;
import sn.isra.seed.order_service.repo.LigneRepo;
import sn.isra.seed.order_service.repo.LotQuantiteRepo;
import sn.isra.seed.order_service.repo.LotReceptionRepo;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.PropositionLigneRepo;
import sn.isra.seed.order_service.repo.ReceptionCommandeRepo;
import sn.isra.seed.order_service.repo.StockOrderRepo;
import sn.isra.seed.order_service.repo.TransfertLotOrderRepo;
import sn.isra.seed.order_service.service.FactureGenerationService;
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
import java.util.Map;
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
  private final sn.isra.seed.order_service.repo.OrganisationRepo organisationRepo;
  private final StockOrderRepo stockOrderRepo;
  private final LotQuantiteRepo lotQuantiteRepo;
  private final LotReceptionRepo lotReceptionRepo;
  private final TransfertLotOrderRepo transfertLotOrderRepo;
  private final sn.isra.seed.order_service.repo.GenerationSemenceRepo generationRepo;
  private final PropositionLigneRepo propositionLigneRepo;
  private final ReceptionCommandeRepo receptionCommandeRepo;
  private final BordereauRepo bordereauRepo;
  private final FactureGenerationService factureGenerationService;
  private final OrderEventProducer producer;
  private final ObjectMapper om;

  /** Badge d'alerte — commandes SOUMISE en attente d'action selon le rôle */
  @GetMapping("/alerts/count")
  public Map<String, Long> alertsCount(@AuthenticationPrincipal Jwt jwt) {
    if (jwt == null) return Map.of("count", 0L);
    String username = jwt.getClaimAsString("preferred_username");
    long count = 0;
    if (isMultiplicateur(jwt)) {
      count = membreRepo.findByKeycloakUsername(username)
          .map(m -> commandeRepo.countSoumisesFournisseur(m.getOrganisation().getId()))
          .orElse(0L);
    } else if (isUpsemcl(jwt)) {
      count = commandeRepo.countSoumisesForUpsemcl();
    } else if (isQuotaire(jwt)) {
      // Alerter le quotataire quand une proposition est EN_NEGOCIATION en attente de sa décision
      count = commandeRepo.countEnNegociationAcheteur(username);
    }
    return Map.of("count", count);
  }

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

  /** Extrait le premier rôle seed-* du JWT. */
  private String extractRole(Jwt jwt) {
    if (jwt == null) return "seed-upsemcl";
    try {
      java.util.Map<String, Object> ra = jwt.getClaim("realm_access");
      if (ra == null) return "seed-upsemcl";
      Object roles = ra.get("roles");
      if (roles instanceof java.util.List<?> list) {
        return list.stream()
            .filter(r -> r instanceof String s && s.startsWith("seed-"))
            .map(Object::toString)
            .findFirst().orElse("seed-upsemcl");
      }
    } catch (Exception ignored) {}
    return "seed-upsemcl";
  }

  /** Déduit le rôle attendu du destinataire selon celui de l'émetteur. */
  private String roleDestinataire(String roleEmetteur) {
    return "seed-upsemcl".equals(roleEmetteur) ? "seed-multiplicator" : "seed-quotataire";
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
    // G3 (id=4) → flux UPSemCL→Multiplicateur ; tout le reste → R2 Mult→Quotataire (défaut)
    if (req.lignes() != null && req.lignes().stream().anyMatch(l -> l.idGeneration() != null && l.idGeneration() == 4L)) {
      c.setTypeCommande(TypeCommande.G3_UPSEMCL_MULT);
    }
    c.setUsernameAcheteur(username);
    c.setIdOrganisationAcheteur(orgAcheteur);
    c.setNomCompletAcheteur(membre.map(m -> m.getNomComplet()).orElse(null));
    c.setNomOrganisationAcheteur(membre.map(m -> m.getOrganisation().getNomOrganisation()).orElse(null));
    c.setLocalisationAcheteur(localisationAcheteur);
    c.setTelephoneAcheteur(membre.map(m -> m.getTelephone()).orElse(null));
    c.setRoleAcheteur(membre.map(m -> m.getKeycloakRole()).orElse(null));

    if (req.idOrganisationFournisseur() != null) {
      organisationRepo.findById(req.idOrganisationFournisseur()).ifPresent(orgF -> {
        c.setNomOrganisationFournisseur(orgF.getNomOrganisation());
        membreRepo.findByOrganisation_Id(orgF.getId()).stream()
            .filter(m -> Boolean.TRUE.equals(m.getPrincipal()))
            .findFirst()
            .or(() -> membreRepo.findByOrganisation_Id(orgF.getId()).stream().findFirst())
            .ifPresent(mf -> {
              c.setNomCompletFournisseur(mf.getNomComplet());
              c.setTelephoneFournisseur(mf.getTelephone() != null ? mf.getTelephone() : orgF.getTelephone());
            });
        if (c.getTelephoneFournisseur() == null) c.setTelephoneFournisseur(orgF.getTelephone());
      });
    }
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
          // updateStatut est réservé à UPSemCL/Multiplicateur/admin — on dérive le rôle dest.
          String codeTransfert = "AUTO-TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
          transfertLotOrderRepo.createAutoTransfert(
              codeTransfert, newLotId, emetteur, "seed-upsemcl",
              commande.getUsernameAcheteur(), "seed-multiplicator",
              alloc.getQuantiteAllouee()
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
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

    commande.setStatut(StatutCommande.ACCEPTEE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/refuser-proposition  (Multiplicateur)
   * Le multiplicateur refuse la proposition — effacement des propositions, retour à SOUMISE.
   * Pré-condition : commande EN_NEGOCIATION.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
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

    String emetteur      = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";
    String roleEmett     = extractRole(jwt);
    String roleDest      = roleDestinataire(roleEmett);
    // Code de base stocké sur la commande ; chaque ligne reçoit un code unique suffixé "-L{id}"
    String baseCode = "TL-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();

    // Dans le nouveau flux G3, seules les lignes ACCORDEE sont transférées.
    // Pour la compatibilité avec l'ancien flux (sans statutLigne), on utilise toutes les lignes.
    List<LigneCommande> lignesATransferer = commande.getLignes().stream()
        .filter(l -> l.getStatutLigne() == StatutLigne.ACCORDEE)
        .toList();
    if (lignesATransferer.isEmpty()) {
      lignesATransferer = commande.getLignes(); // ancien flux
    }

    for (LigneCommande ligne : lignesATransferer) {
      if (ligne.getIdLotPropose() == null || ligne.getQuantiteProposee() == null) {
        // Fallback : chercher dans proposition_ligne
        PropositionLigne prop = propositionLigneRepo.findByLigneCommande_Id(ligne.getId()).orElse(null);
        if (prop != null) {
          ligne.setIdLotPropose(prop.getIdLotSelectionne());
          ligne.setQuantiteProposee(prop.getQuantiteSelectionnee());
        } else {
          throw new ResponseStatusException(HttpStatus.CONFLICT,
              "La ligne #" + ligne.getId() + " n'a pas de proposition enregistrée — re-proposez avant de faire le transfert");
        }
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
          emetteur, roleEmett,
          commande.getUsernameAcheteur(), roleDest,
          ligne.getQuantiteProposee()
      );

      ligne.setStatutLigne(StatutLigne.LIVREE);
      ligneRepo.save(ligne);

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
   * POST /api/orders/{id}/confirmer-et-transferer  (UPSemCL / vendeur)
   * Déclencheur atomique unique : débite lot + stock, crée lot REC + transfert ACCEPTE,
   * génère la facture automatique FCFA et le bordereau.
   * Pré-condition : commande ACCEPTEE.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
  @Transactional
  @PostMapping("/{id}/confirmer-et-transferer")
  public ResponseEntity<Commande> confirmerEtTransferer(
      @PathVariable Long id,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.ACCEPTEE) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être ACCEPTEE pour déclencher le transfert (statut actuel : " + commande.getStatut() + ")");
    }

    String emetteur  = jwt != null ? jwt.getClaimAsString("preferred_username") : "systeme";
    String roleEmett = extractRole(jwt);
    String roleDest  = roleDestinataire(roleEmett);

    // Vérification sécurité : seul le fournisseur peut déclencher
    if (jwt != null && !hasRole(jwt, "seed-admin")) {
      membreRepo.findByKeycloakUsername(emetteur).ifPresent(m -> {
        Long idOrgJwt = m.getOrganisation().getId();
        if (!idOrgJwt.equals(commande.getIdOrganisationFournisseur())) {
          throw new ResponseStatusException(HttpStatus.FORBIDDEN,
              "Vous n'êtes pas le fournisseur de cette commande");
        }
      });
    }

    if (commande.getUsernameAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Acheteur non identifié sur la commande");
    }

    String baseCode = "TL-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
    Long idTransfertPrincipal = null;

    for (LigneCommande ligne : commande.getLignes()) {
      PropositionLigne prop = propositionLigneRepo.findByLigneCommande_Id(ligne.getId()).orElse(null);
      if (prop == null || prop.getIdLotSelectionne() == null || prop.getQuantiteSelectionnee() == null) continue;

      var lot = lotQuantiteRepo.findById(prop.getIdLotSelectionne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
              "Lot #" + prop.getIdLotSelectionne() + " introuvable"));
      String ancienStatut = lot.getStatutLot();

      // Débiter lot fournisseur
      int updated = lotQuantiteRepo.debitLotById(prop.getIdLotSelectionne(), prop.getQuantiteSelectionnee());
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Quantité insuffisante sur le lot #" + prop.getIdLotSelectionne());
      }

      java.math.BigDecimal restant = lot.getQuantiteNette().subtract(prop.getQuantiteSelectionnee());
      boolean epuise = restant.compareTo(java.math.BigDecimal.ZERO) <= 0;
      String nouvoStatut = epuise ? "TRANSFERE" : ancienStatut;
      lotQuantiteRepo.insertHistoriqueTransfert(prop.getIdLotSelectionne(), ancienStatut, nouvoStatut,
          emetteur, "Transfert commande #" + id + " → " + commande.getUsernameAcheteur());

      // Débiter stock fournisseur
      if (commande.getIdOrganisationFournisseur() != null) {
        stockOrderRepo.debitByOrg(prop.getIdLotSelectionne(),
            commande.getIdOrganisationFournisseur(), prop.getQuantiteSelectionnee());
      } else {
        stockOrderRepo.debitUpsemcl(prop.getIdLotSelectionne(), prop.getQuantiteSelectionnee());
      }

      // Créer lot REC chez l'acheteur et créditer son stock
      String codeLotRec = "REC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
      String unite = ligne.getUnite() != null ? ligne.getUnite() : "kg";
      Long idLotRec = lotReceptionRepo.createReceptionLot(
          prop.getIdLotSelectionne(), codeLotRec,
          commande.getIdOrganisationAcheteur(),
          commande.getUsernameAcheteur(),
          prop.getQuantiteSelectionnee(), unite);
      if (commande.getIdOrganisationAcheteur() != null) {
        stockOrderRepo.creditOrg(idLotRec, commande.getIdOrganisationAcheteur(), prop.getQuantiteSelectionnee(), unite);
      } else if (commande.getSiteDestinationCode() != null) {
        stockOrderRepo.creditSiteCode(idLotRec, commande.getSiteDestinationCode(), prop.getQuantiteSelectionnee(), unite);
      }

      // Créer transfert ACCEPTE direct
      String codeLigne = baseCode + "-L" + ligne.getId();
      transfertLotOrderRepo.createAutoTransfert(
          codeLigne, idLotRec, emetteur, roleEmett,
          commande.getUsernameAcheteur(), roleDest,
          prop.getQuantiteSelectionnee());

      // Tracer l'événement d'acceptation dans transfert_lot_event
      transfertLotOrderRepo.insertEventAcceptation(codeLigne, emetteur,
          "Transfert automatique commande #" + id);

      // Garder l'id du transfert principal pour le bordereau
      if (idTransfertPrincipal == null) {
        var transfert = transfertLotOrderRepo.findAll().stream()
            .filter(t -> codeLigne.equals(t.getCodeTransfert())).findFirst();
        transfert.ifPresent(t -> {});
      }

      ligne.setStatutLigne(StatutLigne.LIVREE);
      ligneRepo.save(ligne);

      log.info("[confirmer-et-transferer] lot={} → acheteur={} qty={} commande={}",
          prop.getIdLotSelectionne(), commande.getUsernameAcheteur(),
          prop.getQuantiteSelectionnee(), id);
    }

    commande.setStatut(StatutCommande.TRANSFERE);
    commande.setCodeTransfertGenere(baseCode);
    commandeRepo.save(commande);

    // Génération automatique de la facture (idempotente)
    factureGenerationService.genererFactureAuto(commande, emetteur);

    // Création du bordereau (idempotente)
    if (bordereauRepo.findByIdCommande(id).isEmpty()) {
      Long idOrgEmetteur  = commande.getIdOrganisationFournisseur() != null
          ? commande.getIdOrganisationFournisseur() : 0L;
      Long idOrgDest = commande.getIdOrganisationAcheteur() != null
          ? commande.getIdOrganisationAcheteur() : 0L;
      Bordereau b = new Bordereau();
      b.setTypeBordereau("BORDEREAU_UNIFIE");
      b.setNumeroBordereau("BOR-" + id + "-" + System.currentTimeMillis() % 100000);
      b.setIdCommande(id);
      b.setUsernameEmetteur(emetteur);
      b.setIdOrgEmetteur(idOrgEmetteur);
      b.setIdOrgDestinataire(idOrgDest);
      bordereauRepo.save(b);
    }

    return ResponseEntity.ok(commande);
  }

  /**
   * PATCH /api/orders/{id}/confirmer-reception  (Acheteur)
   * L'acheteur confirme la réception physique des semences.
   * Pré-condition : commande TRANSFERE.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
  @Transactional
  @PatchMapping("/{id}/confirmer-reception")
  public ResponseEntity<Commande> confirmerReception(
      @PathVariable Long id,
      @RequestBody(required = false) java.util.Map<String, String> body,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.TRANSFERE) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être TRANSFERE pour confirmer la réception (statut actuel : " + commande.getStatut() + ")");
    }

    // Vérification sécurité : seul l'acheteur ou un admin peut confirmer la réception
    if (jwt != null && !hasRole(jwt, "seed-admin")) {
      String username = jwt.getClaimAsString("preferred_username");
      membreRepo.findByKeycloakUsername(username).ifPresent(m -> {
        Long idOrgJwt = m.getOrganisation().getId();
        if (!idOrgJwt.equals(commande.getIdOrganisationAcheteur())) {
          throw new ResponseStatusException(HttpStatus.FORBIDDEN,
              "Vous n'êtes pas l'acheteur de cette commande");
        }
      });
    }

    String commentaire = body != null ? body.get("commentaireReception") : null;
    commande.setCommentaireReception(commentaire);
    commande.setStatut(StatutCommande.RECEPTIONNEE);

    log.info("[confirmer-reception] commande={} → RECEPTIONNEE par {}",
        id, jwt != null ? jwt.getClaimAsString("preferred_username") : "inconnu");

    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/accuser-reception  (Multiplicateur)
   * Le multiplicateur confirme avoir reçu les semences.
   * Crédite son stock, valide le transfert (→ ACCEPTE), passe la commande en LIVREE.
   * Pré-condition : commande EN_LIVRAISON.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
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

  /* ══════════════════════════════════════════════════════════════════════
     FLUX G3 FIFO-DSS
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * GET /api/orders/catalogue-g3
   * Catalogue G3 agrégé par variété, pour que les multiplicateurs voient
   * les quantités totales disponibles sans détail lot par lot.
   */
  @GetMapping("/catalogue-g3")
  public List<Map<String, Object>> catalogueG3() {
    return lotQuantiteRepo.findCatalogueG3Agrege().stream().map(row -> {
      Map<String, Object> m = new java.util.LinkedHashMap<>();
      m.put("idVariete",          row[0]);
      m.put("nomVariete",         row[1]);
      m.put("codeVariete",        row[2]);
      m.put("idEspece",           row[3]);
      m.put("nomEspece",          row[4]);
      m.put("codeEspece",         row[5]);
      m.put("idGeneration",       row[6]);
      m.put("codeGeneration",     row[7]);
      m.put("quantiteTotale",     row[8]);
      m.put("nbLots",             row[9]);
      m.put("datePlusAncienLot",  row[10]);
      return m;
    }).toList();
  }

  /**
   * GET /api/orders/lots-g3/{idVariete}
   * Lots G3 UPSemCL pour une variété, ordonnés FIFO (plus ancien en premier).
   * Utilisé par l'interface de proposition de l'agent UPSemCL.
   */
  @GetMapping("/lots-g3/{idVariete}")
  public List<Map<String, Object>> lotsG3Fifo(@PathVariable Long idVariete) {
    return lotQuantiteRepo.findLotsG3FifoPourVariete(idVariete).stream().map(row -> {
      Map<String, Object> m = new java.util.LinkedHashMap<>();
      m.put("id",              row[0]);
      m.put("codeLot",         row[1]);
      m.put("quantiteNette",   row[2]);
      m.put("campagne",        row[3]);
      m.put("createdAt",       row[4]);
      m.put("statutLot",       row[5]);
      m.put("puretePhysique",  row[6]);
      m.put("tauxGermination", row[7]);
      m.put("tauxHumidite",    row[8]);
      return m;
    }).toList();
  }

  /**
   * POST /api/orders/{id}/propositions-g3  (UPSemCL)
   * L'agent soumet sa proposition FIFO-DSS pour chaque ligne de la commande.
   * Crée ou remplace les PropositionLigne existantes + leurs sources d'audit.
   * Pré-condition : commande SOUMISE ou EN_NEGOCIATION.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-admin')")
  @Transactional
  @PostMapping("/{id}/propositions-g3")
  public ResponseEntity<Commande> propositionsG3(
      @PathVariable Long id,
      @Valid @RequestBody PropositionG3Request req,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.SOUMISE && commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seule une commande SOUMISE ou EN_NEGOCIATION accepte une proposition (statut actuel : " + commande.getStatut() + ")");
    }

    String usernameAgent = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";

    for (PropositionG3Request.LigneProposition item : req.propositions()) {
      LigneCommande ligne = ligneRepo.findById(item.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne #" + item.idLigne() + " introuvable"));
      if (!ligne.getCommande().getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne #" + item.idLigne() + " n'appartient pas à cette commande");
      }
      if (item.idLotSelectionne() != item.idLotSuggereFifo()
          && item.idLotSuggereFifo() != null
          && (item.motifOverride() == null || item.motifOverride().isBlank())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Un motif est obligatoire lorsque l'agent sélectionne un lot différent de la suggestion FIFO (ligne #" + item.idLigne() + ")");
      }

      // Supprimer l'ancienne proposition si elle existe (re-proposition)
      propositionLigneRepo.findByLigneCommande_Id(item.idLigne()).ifPresent(old -> propositionLigneRepo.delete(old));

      PropositionLigne prop = new PropositionLigne();
      prop.setLigneCommande(ligne);
      prop.setIdLotSuggereFifo(item.idLotSuggereFifo());
      prop.setQuantiteSuggere(item.quantiteSuggere());
      prop.setIdLotSelectionne(item.idLotSelectionne());
      prop.setQuantiteSelectionnee(item.quantiteSelectionnee());
      prop.setMotifOverride(item.motifOverride());
      prop.setPrixUnitaireHt(item.prixUnitaireHt());
      prop.setTauxTva(item.tauxTva() != null ? item.tauxTva() : java.math.BigDecimal.ZERO);
      prop.setUsernameAgent(usernameAgent);
      prop.setStatutProposition("PROPOSEE");
      prop.setCreatedAt(Instant.now());
      PropositionLigne savedProp = propositionLigneRepo.save(prop);

      // Source FIFO suggérée
      if (item.idLotSuggereFifo() != null) {
        PropositionLotSource src = new PropositionLotSource();
        src.setPropositionLigne(savedProp);
        src.setIdLot(item.idLotSuggereFifo());
        src.setQuantite(item.quantiteSuggere() != null ? item.quantiteSuggere() : item.quantiteSelectionnee());
        src.setFifoSuggere(true);
        src.setOrdrePriorite(1);
        savedProp.getSources().add(src);
      }

      // Source réelle si différente de la suggestion
      if (!item.idLotSelectionne().equals(item.idLotSuggereFifo())) {
        PropositionLotSource srcReal = new PropositionLotSource();
        srcReal.setPropositionLigne(savedProp);
        srcReal.setIdLot(item.idLotSelectionne());
        srcReal.setQuantite(item.quantiteSelectionnee());
        srcReal.setFifoSuggere(false);
        srcReal.setOrdrePriorite(2);
        savedProp.getSources().add(srcReal);
      }
      propositionLigneRepo.save(savedProp);

      // Mise à jour du lot proposé sur la ligne (compatibilité ancien flux)
      ligne.setIdLotPropose(item.idLotSelectionne());
      ligne.setQuantiteProposee(item.quantiteSelectionnee());
      ligne.setStatutLigne(StatutLigne.EN_NEGOCIATION);
      ligneRepo.save(ligne);
    }

    commande.setStatut(StatutCommande.EN_NEGOCIATION);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/decision-multiplicateur  (Multiplicateur)
   * Le multiplicateur accepte ou refuse chaque ligne individuellement.
   * Si au moins une ligne est acceptée → commande ACCORDEE.
   * Si toutes refusées → commande revient à SOUMISE.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-admin')")
  @Transactional
  @PatchMapping("/{id}/decision-multiplicateur")
  public ResponseEntity<Commande> decisionMultiplicateur(
      @PathVariable Long id,
      @Valid @RequestBody DecisionMultiplicateurRequest req) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_NEGOCIATION pour soumettre une décision (statut actuel : " + commande.getStatut() + ")");
    }

    if (req.siteDestinationCode() != null && !req.siteDestinationCode().isBlank()) {
      commande.setSiteDestinationCode(req.siteDestinationCode());
    }

    long nbAccordees = 0;
    for (DecisionMultiplicateurRequest.DecisionLigne dec : req.decisions()) {
      LigneCommande ligne = ligneRepo.findById(dec.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne #" + dec.idLigne() + " introuvable"));
      if (!ligne.getCommande().getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne #" + dec.idLigne() + " n'appartient pas à cette commande");
      }

      StatutLigne nouveauStatutLigne = dec.accepte() ? StatutLigne.ACCORDEE : StatutLigne.REFUSEE;
      ligne.setStatutLigne(nouveauStatutLigne);
      ligneRepo.save(ligne);

      propositionLigneRepo.findByLigneCommande_Id(dec.idLigne()).ifPresent(prop -> {
        prop.setStatutProposition(dec.accepte() ? "ACCEPTEE" : "REFUSEE");
        propositionLigneRepo.save(prop);
      });

      if (dec.accepte()) nbAccordees++;
    }

    StatutCommande nouveauStatut = nbAccordees > 0 ? StatutCommande.ACCORDEE : StatutCommande.SOUMISE;
    commande.setStatut(nouveauStatut);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * POST /api/orders/{id}/confirmer-reception  (Multiplicateur ou Quotataire)
   * Confirme la réception physique des semences. Crédite le stock de l'acheteur,
   * enregistre les écarts éventuels, passe la commande en LIVREE.
   * Utilisé par le multiplicateur (flux G3) et le quotataire (flux R2).
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
  @Transactional
  @PostMapping("/{id}/confirmer-reception")
  public ResponseEntity<Commande> confirmerReception(
      @PathVariable Long id,
      @RequestBody(required = false) ReceptionConfirmationRequest req,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_LIVRAISON) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_LIVRAISON pour confirmer la réception (statut actuel : " + commande.getStatut() + ")");
    }
    if (commande.getIdOrganisationAcheteur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation acheteur non renseignée — impossible de créditer le stock");
    }

    String usernameRecepteur = jwt != null ? jwt.getClaimAsString("preferred_username") : commande.getUsernameAcheteur();
    String siteDestCode = commande.getSiteDestinationCode();

    boolean avecEcart = req != null && req.ecarts() != null && !req.ecarts().isEmpty();

    for (LigneCommande ligne : commande.getLignes()) {
      if (ligne.getIdLotPropose() == null || ligne.getQuantiteProposee() == null) continue;

      String unite = ligne.getUnite() != null ? ligne.getUnite() : "kg";
      String codeLot = "REC-" + commande.getId() + "-L" + ligne.getId();
      Long newLotId = lotReceptionRepo.createReceptionLot(
          ligne.getIdLotPropose(), codeLot,
          commande.getIdOrganisationAcheteur(),
          commande.getUsernameAcheteur(),
          ligne.getQuantiteProposee(), unite);

      if (siteDestCode != null && !siteDestCode.isBlank()) {
        stockOrderRepo.creditSiteCode(newLotId, siteDestCode, ligne.getQuantiteProposee(), unite);
      } else {
        stockOrderRepo.creditOrg(newLotId, commande.getIdOrganisationAcheteur(), ligne.getQuantiteProposee(), unite);
      }

      if (commande.getCodeTransfertGenere() != null) {
        transfertLotOrderRepo.updateTransfertIdLot(
            commande.getCodeTransfertGenere(), ligne.getIdLotPropose(), newLotId);
      }
    }

    if (commande.getCodeTransfertGenere() != null) {
      transfertLotOrderRepo.accepterTransfert(commande.getCodeTransfertGenere());
    }

    // Enregistrer la réception
    ReceptionCommande reception = new ReceptionCommande();
    reception.setCommande(commande);
    reception.setUsernameRecepteur(usernameRecepteur);
    reception.setDateReception(Instant.now());
    reception.setStatutReception(avecEcart ? "AVEC_ECART" : "COMPLET");
    reception.setObservations(req != null ? req.observations() : null);
    reception.setCreatedAt(Instant.now());
    ReceptionCommande savedReception = receptionCommandeRepo.save(reception);

    if (avecEcart) {
      for (ReceptionConfirmationRequest.EcartLot e : req.ecarts()) {
        ReceptionEcart ecart = new ReceptionEcart();
        ecart.setReceptionCommande(savedReception);
        ecart.setIdLotSource(e.idLotSource());
        ecart.setQuantiteTransferee(e.quantiteTransferee());
        ecart.setQuantiteRecue(e.quantiteRecue());
        ecart.setObservations(e.observations());
        savedReception.getEcarts().add(ecart);
      }
      receptionCommandeRepo.save(savedReception);
    }

    commande.setStatut(StatutCommande.LIVREE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * GET /api/orders/{id}/bordereau-transfert  (UPSemCL)
   * Données du Bordereau de Transfert (BT) couvrant toutes les variétés.
   */
  @GetMapping("/{id}/bordereau-transfert")
  public ResponseEntity<Map<String, Object>> bordereauTransfert(@PathVariable Long id) {
    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    List<Map<String, Object>> lignesDetail = commande.getLignes().stream().map(ligne -> {
      Map<String, Object> m = new java.util.LinkedHashMap<>();
      m.put("idLigne",          ligne.getId());
      m.put("idVariete",        ligne.getIdVariete());
      m.put("idGeneration",     ligne.getIdGeneration());
      m.put("quantiteDemandee", ligne.getQuantiteDemandee());
      m.put("quantiteProposee", ligne.getQuantiteProposee());
      m.put("idLotPropose",     ligne.getIdLotPropose());
      m.put("statutLigne",      ligne.getStatutLigne());
      m.put("unite",            ligne.getUnite() != null ? ligne.getUnite() : "kg");

      propositionLigneRepo.findByLigneCommande_Id(ligne.getId()).ifPresent(prop -> {
        m.put("proposition", Map.of(
            "idLotSuggereFifo",    prop.getIdLotSuggereFifo(),
            "quantiteSuggere",     prop.getQuantiteSuggere(),
            "idLotSelectionne",    prop.getIdLotSelectionne(),
            "quantiteSelectionnee",prop.getQuantiteSelectionnee(),
            "motifOverride",       prop.getMotifOverride() != null ? prop.getMotifOverride() : "",
            "usernameAgent",       prop.getUsernameAgent() != null ? prop.getUsernameAgent() : "",
            "statutProposition",   prop.getStatutProposition(),
            "sources",             prop.getSources().stream().map(s -> Map.of(
                "idLot",        s.getIdLot(),
                "quantite",     s.getQuantite(),
                "fifoSuggere",  s.isFifoSuggere(),
                "ordrePriorite",s.getOrdrePriorite()
            )).toList()
        ));
      });
      return m;
    }).toList();

    Map<String, Object> bt = new java.util.LinkedHashMap<>();
    bt.put("codeCommande",             commande.getCodeCommande());
    bt.put("statut",                   commande.getStatut());
    bt.put("codeTransfertGenere",      commande.getCodeTransfertGenere());
    bt.put("nomOrganisationAcheteur",  commande.getNomOrganisationAcheteur());
    bt.put("nomCompletAcheteur",       commande.getNomCompletAcheteur());
    bt.put("localisationAcheteur",     commande.getLocalisationAcheteur());
    bt.put("siteDestinationCode",      commande.getSiteDestinationCode());
    bt.put("createdAt",                commande.getCreatedAt());
    bt.put("lignes",                   lignesDetail);
    return ResponseEntity.ok(bt);
  }

  /**
   * GET /api/orders/{id}/bordereau-reception  (Multiplicateur)
   * Données du Bordereau de Réception (BR) avec confirmation et écarts.
   */
  @GetMapping("/{id}/bordereau-reception")
  public ResponseEntity<Map<String, Object>> bordereauReception(@PathVariable Long id) {
    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    Map<String, Object> br = new java.util.LinkedHashMap<>();
    br.put("codeCommande",             commande.getCodeCommande());
    br.put("statut",                   commande.getStatut());
    br.put("codeTransfertGenere",      commande.getCodeTransfertGenere());
    br.put("nomOrganisationAcheteur",  commande.getNomOrganisationAcheteur());
    br.put("nomCompletAcheteur",       commande.getNomCompletAcheteur());
    br.put("siteDestinationCode",      commande.getSiteDestinationCode());
    br.put("createdAt",                commande.getCreatedAt());

    br.put("lignes", commande.getLignes().stream().map(l -> {
      Map<String, Object> m = new java.util.LinkedHashMap<>();
      m.put("idLigne",          l.getId());
      m.put("idVariete",        l.getIdVariete());
      m.put("idGeneration",     l.getIdGeneration());
      m.put("quantiteDemandee", l.getQuantiteDemandee());
      m.put("quantiteProposee", l.getQuantiteProposee());
      m.put("statutLigne",      l.getStatutLigne());
      m.put("unite",            l.getUnite() != null ? l.getUnite() : "kg");
      return m;
    }).toList());

    receptionCommandeRepo.findByCommande_Id(id).ifPresent(rec -> {
      Map<String, Object> recMap = new java.util.LinkedHashMap<>();
      recMap.put("dateReception",      rec.getDateReception());
      recMap.put("usernameRecepteur",  rec.getUsernameRecepteur());
      recMap.put("statutReception",    rec.getStatutReception());
      recMap.put("observations",       rec.getObservations());
      recMap.put("ecarts", rec.getEcarts().stream().map(e -> Map.of(
          "idLotSource",       e.getIdLotSource(),
          "quantiteTransferee",e.getQuantiteTransferee(),
          "quantiteRecue",     e.getQuantiteRecue(),
          "observations",      e.getObservations() != null ? e.getObservations() : ""
      )).toList());
      br.put("reception", recMap);
    });

    return ResponseEntity.ok(br);
  }

  /* ══════════════════════════════════════════════════════════════════════
     FLUX R2 CATALOGUE — MULTIPLICATEUR → QUOTATAIRE
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * POST /api/orders/{id}/propositions-r2  (Multiplicateur)
   * Le multiplicateur propose ses lots R2 au quotataire avec un prix unitaire HT.
   * Crée ou remplace les PropositionLigne ; passe la commande EN_NEGOCIATION.
   * Pré-condition : commande SOUMISE ou EN_NEGOCIATION.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-admin')")
  @Transactional
  @PostMapping("/{id}/propositions-r2")
  public ResponseEntity<Commande> propositionsR2(
      @PathVariable Long id,
      @Valid @RequestBody PropositionR2Request req,
      @AuthenticationPrincipal Jwt jwt) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.SOUMISE && commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seule une commande SOUMISE ou EN_NEGOCIATION accepte une proposition R2 (statut actuel : " + commande.getStatut() + ")");
    }

    String usernameAgent = jwt != null ? jwt.getClaimAsString("preferred_username") : "multiplicateur";

    for (PropositionR2Request.LigneProposition item : req.propositions()) {
      LigneCommande ligne = ligneRepo.findById(item.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne #" + item.idLigne() + " introuvable"));
      if (!ligne.getCommande().getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne #" + item.idLigne() + " n'appartient pas à cette commande");
      }

      propositionLigneRepo.findByLigneCommande_Id(item.idLigne()).ifPresent(propositionLigneRepo::delete);

      PropositionLigne prop = new PropositionLigne();
      prop.setLigneCommande(ligne);
      prop.setIdLotSelectionne(item.idLotSelectionne());
      prop.setQuantiteSelectionnee(item.quantiteSelectionnee());
      prop.setPrixUnitaireHt(item.prixUnitaireHt());
      prop.setTauxTva(item.tauxTva() != null ? item.tauxTva() : java.math.BigDecimal.ZERO);
      prop.setUsernameAgent(usernameAgent);
      prop.setStatutProposition("PROPOSEE");
      prop.setCreatedAt(Instant.now());
      propositionLigneRepo.save(prop);

      ligne.setIdLotPropose(item.idLotSelectionne());
      ligne.setQuantiteProposee(item.quantiteSelectionnee());
      ligne.setStatutLigne(StatutLigne.EN_NEGOCIATION);
      ligneRepo.save(ligne);
    }

    commande.setStatut(StatutCommande.EN_NEGOCIATION);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  /**
   * PATCH /api/orders/{id}/decision-quotataire  (Quotataire)
   * Le quotataire accepte ou refuse chaque ligne individuellement.
   * ≥1 acceptée → ACCORDEE ; toutes refusées → retour à SOUMISE.
   * Pré-condition : commande EN_NEGOCIATION.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-quotataire','ROLE_seed-admin')")
  @Transactional
  @PatchMapping("/{id}/decision-quotataire")
  public ResponseEntity<Commande> decisionQuotataire(
      @PathVariable Long id,
      @Valid @RequestBody DecisionQuotataireRequest req) {

    Commande commande = commandeRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

    if (commande.getStatut() != StatutCommande.EN_NEGOCIATION) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "La commande doit être EN_NEGOCIATION pour soumettre une décision (statut actuel : " + commande.getStatut() + ")");
    }

    long nbAccordees = 0;
    for (DecisionQuotataireRequest.DecisionLigne dec : req.decisions()) {
      LigneCommande ligne = ligneRepo.findById(dec.idLigne())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne #" + dec.idLigne() + " introuvable"));
      if (!ligne.getCommande().getId().equals(id)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne #" + dec.idLigne() + " n'appartient pas à cette commande");
      }

      ligne.setStatutLigne(dec.accepte() ? StatutLigne.ACCORDEE : StatutLigne.REFUSEE);
      ligneRepo.save(ligne);

      propositionLigneRepo.findByLigneCommande_Id(dec.idLigne()).ifPresent(prop -> {
        prop.setStatutProposition(dec.accepte() ? "ACCEPTEE" : "REFUSEE");
        propositionLigneRepo.save(prop);
      });

      if (dec.accepte()) nbAccordees++;
    }

    commande.setStatut(nbAccordees > 0 ? StatutCommande.ACCORDEE : StatutCommande.SOUMISE);
    return ResponseEntity.ok(commandeRepo.save(commande));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
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
  @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
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

    String emetteur  = jwt != null ? jwt.getClaimAsString("preferred_username") : "upsemcl";
    String roleEmett = extractRole(jwt);
    String roleDest  = roleDestinataire(roleEmett);

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

      // 2b. Débiter le stock du fournisseur réel : multiplicateur ou UPSemCL selon la commande
      if (commande.getIdOrganisationFournisseur() != null) {
        stockOrderRepo.debitByOrg(item.idLot(), commande.getIdOrganisationFournisseur(), item.quantite());
      } else {
        stockOrderRepo.debitUpsemcl(item.idLot(), item.quantite());
      }

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
          emetteur, roleEmett,
          commande.getUsernameAcheteur(), roleDest,
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
