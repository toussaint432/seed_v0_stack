package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.api.dto.AllocateRequest;
import sn.isra.seed.order_service.api.dto.CreateOrderRequest;
import sn.isra.seed.order_service.api.dto.StatutRequest;
import sn.isra.seed.order_service.entity.AllocationCommande;
import sn.isra.seed.order_service.entity.Commande;
import sn.isra.seed.order_service.entity.LigneCommande;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.kafka.OrderEventProducer;
import sn.isra.seed.order_service.repo.AllocationRepo;
import sn.isra.seed.order_service.repo.CommandeRepo;
import sn.isra.seed.order_service.repo.LigneRepo;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

  private final CommandeRepo commandeRepo;
  private final LigneRepo ligneRepo;
  private final AllocationRepo allocationRepo;
  private final MembreOrganisationRepo membreRepo;
  private final OrderEventProducer producer;
  private final ObjectMapper om;

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
    try {
      java.util.Map<String, Object> ra = jwt.getClaim("realm_access");
      if (ra == null) return false;
      Object roles = ra.get("roles");
      if (roles instanceof java.util.List<?> list) return list.contains("seed-multiplicator");
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

  /** Commandes reçues par l'organisation du multiplicateur connecté */
  @GetMapping("/a-traiter")
  public List<Commande> aTraiter(@AuthenticationPrincipal Jwt jwt) {
    String username = jwt.getClaimAsString("preferred_username");
    return membreRepo.findByKeycloakUsername(username)
        .map(m -> commandeRepo.findByIdOrganisationFournisseurOrderByCreatedAtDesc(
            m.getOrganisation().getId()))
        .orElse(List.of());
  }

  @Transactional
  @PostMapping
  public Commande create(@RequestBody CreateOrderRequest req,
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

  /** Changer le statut d'une commande (multiplicateur : ACCEPTEE / ANNULEE…) */
  @PutMapping("/{id}/statut")
  public ResponseEntity<Commande> updateStatut(@PathVariable Long id,
                                               @RequestBody StatutRequest req) {
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
      return ResponseEntity.ok(commandeRepo.save(c));
    }).orElse(ResponseEntity.notFound().build());
  }

  @PostMapping("/allocate")
  public AllocationCommande allocate(@RequestBody AllocateRequest req) {
    LigneCommande ligne = ligneRepo.findById(req.idLigne()).orElseThrow();
    AllocationCommande a = new AllocationCommande();
    a.setLigne(ligne);
    a.setIdLot(req.idLot());
    a.setQuantiteAllouee(req.quantite());
    a.setCreatedAt(Instant.now());
    return allocationRepo.save(a);
  }
}
