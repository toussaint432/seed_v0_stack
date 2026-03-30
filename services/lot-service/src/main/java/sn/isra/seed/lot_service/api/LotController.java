package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.api.dto.CreateChildLotRequest;
import sn.isra.seed.lot_service.api.dto.LineageNode;
import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotRepo lotRepo;
    private final GenerationRepo generationRepo;
    private final TransfertLotRepo transfertRepo;
    private final LotEventProducer producer;
    private final ObjectMapper om = new ObjectMapper();

    private static final Map<String, String> FLUX_RULES = Map.of(
        "seed-selector", "seed-upseml",
        "seed-upseml",   "seed-multiplicator"
    );

    // ── Liste tous les lots avec filtre optionnel génération ──
    @GetMapping
    public List<LotSemencier> list(
            @RequestParam(required = false) String generation,
            @RequestParam(required = false) Long idVariete) {
        if (generation != null && !generation.isBlank())
            return lotRepo.findByGeneration_CodeGeneration(generation);
        if (idVariete != null)
            return lotRepo.findByIdVariete(idVariete);
        return lotRepo.findAll();
    }

    // ── Détail d'un lot ───────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<LotSemencier> getById(@PathVariable Long id) {
        return lotRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Créer un lot racine (G0) ──────────────────────────────
    @PostMapping
    public LotSemencier create(@RequestBody LotSemencier lot,
                                @AuthenticationPrincipal Jwt jwt) throws Exception {
        // Phase 1 : extraire le username du JWT et stocker la traçabilité
        if (jwt != null) {
            String username = jwt.getClaimAsString("preferred_username");
            if (lot.getUsernameCreateur() == null) {
                lot.setUsernameCreateur(username);
            }
            // Le responsable_nom et responsable_role peuvent être envoyés
            // par le frontend (qui les a résolus via order-service)
            // ou remplis par défaut depuis le JWT
            if (lot.getResponsableNom() == null) {
                String firstName = jwt.getClaimAsString("given_name");
                String lastName = jwt.getClaimAsString("family_name");
                lot.setResponsableNom(
                    (firstName != null ? firstName : "") + " " +
                    (lastName != null ? lastName : "")
                );
            }
            if (lot.getResponsableRole() == null) {
                List<String> roles = extractRealmRoles(jwt);
                lot.setResponsableRole(detectSeedRole(roles));
            }
        }
        LotSemencier saved = lotRepo.save(lot);
        producer.lotCreated(om.writeValueAsString(saved));
        return saved;
    }

    // ── Créer un lot enfant (G1 depuis G0, G2 depuis G1…) ────
    @PostMapping("/{id}/child")
    public LotSemencier createChild(@PathVariable Long id,
                                     @RequestBody CreateChildLotRequest req,
                                     @AuthenticationPrincipal Jwt jwt) throws Exception {
        LotSemencier parent = lotRepo.findById(id).orElseThrow();
        Generation gen = generationRepo.findByCodeGeneration(req.generationCode()).orElseThrow();

        LotSemencier child = new LotSemencier();
        child.setCodeLot(req.codeLot());
        child.setIdVariete(req.idVariete() != null ? req.idVariete() : parent.getIdVariete());
        child.setGeneration(gen);
        child.setLotParent(parent);
        child.setCampagne(req.campagne());
        child.setDateProduction(req.dateProduction());
        child.setQuantiteNette(req.quantiteNette());
        child.setUnite(req.unite() == null ? "kg" : req.unite());
        child.setTauxGermination(req.tauxGermination());
        child.setPuretePhysique(req.puretePhysique());
        child.setStatutLot("DISPONIBLE");

        // Phase 1 : traçabilité acteur
        if (jwt != null) {
            child.setUsernameCreateur(jwt.getClaimAsString("preferred_username"));
            if (req.responsableNom() != null) {
                child.setResponsableNom(req.responsableNom());
            } else {
                String fn = jwt.getClaimAsString("given_name");
                String ln = jwt.getClaimAsString("family_name");
                child.setResponsableNom((fn != null ? fn : "") + " " + (ln != null ? ln : ""));
            }
            child.setResponsableRole(req.responsableRole() != null
                    ? req.responsableRole()
                    : detectSeedRole(extractRealmRoles(jwt)));
            child.setIdOrgProducteur(req.idOrgProducteur());
        }

        LotSemencier saved = lotRepo.save(child);
        producer.lotCreated(om.writeValueAsString(saved));
        return saved;
    }

    // ── Changer le statut d'un lot ────────────────────────────
    @PatchMapping("/{id}/statut")
    public ResponseEntity<LotSemencier> updateStatut(@PathVariable Long id,
                                                       @RequestBody Map<String, String> body) {
        return lotRepo.findById(id).map(lot -> {
            lot.setStatutLot(body.get("statut"));
            return ResponseEntity.ok(lotRepo.save(lot));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Transférer un lot vers un autre acteur ────────────────
    @PostMapping("/{id}/transfer")
    public ResponseEntity<?> transfer(@PathVariable Long id,
                                      @RequestBody Map<String, Object> body,
                                      @AuthenticationPrincipal Jwt jwt) {
        String usernameEmetteur = jwt.getClaimAsString("preferred_username");
        List<String> roles = extractRealmRoles(jwt);
        String roleEmetteur = roles.stream().filter(FLUX_RULES::containsKey).findFirst().orElse(null);

        if (roleEmetteur == null)
            return ResponseEntity.status(403).body(Map.of("message", "Rôle non autorisé à créer un transfert"));

        LotSemencier lot = lotRepo.findById(id).orElse(null);
        if (lot == null) return ResponseEntity.notFound().build();

        String usernameDestinataire = (String) body.get("usernameDestinataire");
        String roleDestinataire = (String) body.getOrDefault("roleDestinataire", FLUX_RULES.get(roleEmetteur));
        String observations = (String) body.getOrDefault("observations", "");
        Object qte = body.get("quantite");

        if (usernameDestinataire == null)
            return ResponseEntity.badRequest().body(Map.of("message", "usernameDestinataire requis"));

        String destAttendu = FLUX_RULES.get(roleEmetteur);
        if (!destAttendu.equals(roleDestinataire))
            return ResponseEntity.badRequest().body(Map.of("message", "Flux non autorisé : " + roleEmetteur + " → " + roleDestinataire));

        String gen = lot.getGeneration() != null ? lot.getGeneration().getCodeGeneration() : "";
        boolean genOk = ("seed-selector".equals(roleEmetteur) && List.of("G0","G1").contains(gen))
                     || ("seed-upseml".equals(roleEmetteur)   && List.of("G2","G3").contains(gen));
        if (!genOk)
            return ResponseEntity.badRequest().body(Map.of("message", "Génération " + gen + " non transférable pour " + roleEmetteur));

        TransfertLot t = new TransfertLot();
        t.setCodeTransfert("TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        t.setIdLot(id);
        t.setUsernameEmetteur(usernameEmetteur);
        t.setRoleEmetteur(roleEmetteur);
        t.setUsernameDestinataire(usernameDestinataire);
        t.setRoleDestinataire(roleDestinataire);
        t.setGenerationTransferee(gen);
        t.setObservations(observations);
        if (qte instanceof Number) t.setQuantite(new BigDecimal(qte.toString()));

        TransfertLot saved = transfertRepo.save(t);
        return ResponseEntity.status(201).body(saved);
    }

    // ── Arbre généalogique G0→R2 enrichi avec acteurs ────────
    @GetMapping("/{id}/lineage")
    public ResponseEntity<List<LineageNode>> lineage(@PathVariable Long id) {
        List<LineageNode> chain = new ArrayList<>();
        lotRepo.findById(id).ifPresent(lot -> {
            LotSemencier current = lot;
            while (current != null) {
                chain.add(0, LineageNode.from(current));
                current = current.getLotParent();
            }
        });
        return chain.isEmpty()
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(chain);
    }

    // ── Helpers JWT ───────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private List<String> extractRealmRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return List.of();
        Object roles = realmAccess.get("roles");
        if (roles instanceof List<?>) return (List<String>) roles;
        return List.of();
    }

    private String detectSeedRole(List<String> roles) {
        for (String r : List.of("seed-admin", "seed-selector", "seed-upseml",
                                 "seed-multiplicator", "seed-quotataire")) {
            if (roles.contains(r)) return r;
        }
        return "inconnu";
    }
}
