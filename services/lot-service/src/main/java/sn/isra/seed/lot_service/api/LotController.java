package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.api.dto.CreateChildLotRequest;
import sn.isra.seed.lot_service.api.dto.LineageNode;
import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final LotEventProducer producer;
    private final ObjectMapper om; // injecté par Spring (JavaTimeModule inclus)

    private static final Map<String, String> FLUX_RULES = Map.of(
        "seed-selector",    "seed-upsemcl",
        "seed-upsemcl",     "seed-multiplicator"
    );

    // ── Liste tous les lots avec filtre optionnel ─────────────
    // Isolation par rôle :
    //   seed-selector     → G0+G1 filtrés par spécialisation espèce
    //   seed-multiplicator → G3→R2 de son organisation uniquement
    //   autres             → tous les lots (avec filtre optionnel)
    @GetMapping
    public List<LotSemencier> list(
            @RequestParam(required = false) String generation,
            @RequestParam(required = false) Long idVariete,
            @AuthenticationPrincipal Jwt jwt) {
        List<String> roles = jwt != null ? extractRealmRoles(jwt) : List.of();

        // Isolation sélectionneur : G0+G1 filtrés par spécialisation
        if (roles.contains("seed-selector")) {
            String raw = jwt != null ? jwt.getClaimAsString("specialisation") : null;
            // Normalisé en majuscules pour correspondre à la query JPQL (évite upper(bytea))
            String specialisation = raw != null ? raw.toUpperCase() : null;
            return lotRepo.findForSelector(specialisation);
        }

        // Isolation multiplicateur : uniquement ses propres lots G3→R2
        if (roles.contains("seed-multiplicator")) {
            Object orgClaim = jwt != null ? jwt.getClaim("org_id") : null;
            if (orgClaim != null) {
                try {
                    Long orgId = Long.parseLong(orgClaim.toString());
                    return lotRepo.findMesLots(orgId);
                } catch (NumberFormatException ignored) {}
            }
            return List.of();
        }

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
        if (jwt != null) {
            String username = jwt.getClaimAsString("preferred_username");
            if (lot.getUsernameCreateur() == null) lot.setUsernameCreateur(username);
            if (lot.getResponsableNom() == null) {
                String fn = jwt.getClaimAsString("given_name");
                String ln = jwt.getClaimAsString("family_name");
                lot.setResponsableNom((fn != null ? fn : "") + " " + (ln != null ? ln : ""));
            }
            if (lot.getResponsableRole() == null)
                lot.setResponsableRole(detectSeedRole(extractRealmRoles(jwt)));
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
        // Héritage de l'espèce depuis le parent (indispensable pour le filtre par spécialisation)
        child.setCodeEspece(req.codeEspece() != null ? req.codeEspece() : parent.getCodeEspece());
        child.setGeneration(gen);
        child.setLotParent(parent);
        child.setCampagne(req.campagne());
        child.setDateProduction(req.dateProduction());
        child.setQuantiteNette(req.quantiteNette());
        child.setUnite(req.unite() == null ? "kg" : req.unite());
        child.setTauxGermination(req.tauxGermination());
        child.setPuretePhysique(req.puretePhysique());
        child.setStatutLot(StatutLot.DISPONIBLE);

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

    // ── Changer le statut d'un lot (réservé admin) ───────────
    // Les transitions métier (DISPONIBLE→TRANSFERE) passent par /transfer ou /accept
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PatchMapping("/{id}/statut")
    public ResponseEntity<LotSemencier> updateStatut(@PathVariable Long id,
                                                       @RequestBody Map<String, String> body) {
        String statutStr = body.get("statut");
        if (statutStr == null || statutStr.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'statut' est obligatoire");
        StatutLot nouveauStatut;
        try {
            nouveauStatut = StatutLot.valueOf(statutStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Statut invalide : " + statutStr);
        }
        return lotRepo.findById(id).map(lot -> {
            lot.setStatutLot(nouveauStatut);
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
            return ResponseEntity.badRequest().body(
                Map.of("message", "Flux non autorisé : " + roleEmetteur + " → " + roleDestinataire));

        String gen = lot.getGeneration() != null ? lot.getGeneration().getCodeGeneration() : "";

        // Règle métier : seed-selector ne peut transférer que les lots G1 (pas G0)
        // seed-upsemcl transfère G2 ou G3 vers le multiplicateur
        boolean genOk = ("seed-selector".equals(roleEmetteur) && "G1".equals(gen))
                     || ("seed-upsemcl".equals(roleEmetteur)   && List.of("G2","G3").contains(gen));
        if (!genOk)
            return ResponseEntity.badRequest().body(
                Map.of("message", "Génération " + gen + " non transférable pour " + roleEmetteur
                    + ". Seuls les lots G1 peuvent être transférés par le sélectionneur."));

        // Vérifier spécialisation : seed-selector ne transfère que les lots de son espèce
        if ("seed-selector".equals(roleEmetteur)) {
            String specialisation = jwt.getClaimAsString("specialisation");
            if (specialisation != null && lot.getCodeEspece() != null
                    && !specialisation.equalsIgnoreCase(lot.getCodeEspece())) {
                return ResponseEntity.status(403).body(
                    Map.of("message", "Lot d'espèce " + lot.getCodeEspece()
                        + " hors de votre spécialisation (" + specialisation + ")"));
            }
        }

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

        // ── Journal d'audit : transition DISPONIBLE → TRANSFERE ──
        StatutLot ancienStatut = lot.getStatutLot();
        lot.setStatutLot(StatutLot.TRANSFERE);
        lotRepo.save(lot);
        historiqueRepo.save(HistoriqueStatutLot.of(
            id,
            ancienStatut,
            StatutLot.TRANSFERE,
            usernameEmetteur,
            "Transfert " + gen + " vers " + usernameDestinataire
                + " [" + roleDestinataire + "] — code: " + saved.getCodeTransfert()
        ));

        return ResponseEntity.status(201).body(saved);
    }

    // ── Arbre généalogique G0→R2 ──────────────────────────────
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

    // ── Catalogue G3 visible par les multiplicateurs ─────────
    // Retourne TOUS les lots G3 DISPONIBLES (vitrine de l'UPSemCL)
    @GetMapping("/catalogue-g3")
    public List<LotSemencier> catalogueG3() {
        return lotRepo.findCatalogueG3(StatutLot.DISPONIBLE);
    }

    // ── Lots propres au multiplicateur connecté ───────────────
    // Isolé par organisation : chaque multiplicateur ne voit que ses G3→R2
    @GetMapping("/mes-lots")
    public ResponseEntity<List<LotSemencier>> mesLots(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(401).build();
        // L'org est résolu depuis le claim "org_id" injecté par Keycloak mapper,
        // ou via le champ responsable_role en fallback.
        // On utilise idOrgProducteur stocké sur le lot au moment de la création.
        Object orgClaim = jwt.getClaim("org_id");
        if (orgClaim == null)
            return ResponseEntity.ok(List.of()); // pas encore rattaché à une org
        Long orgId;
        try { orgId = Long.parseLong(orgClaim.toString()); }
        catch (NumberFormatException e) { return ResponseEntity.badRequest().build(); }
        return ResponseEntity.ok(lotRepo.findMesLots(orgId));
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
        for (String r : List.of("seed-admin", "seed-selector", "seed-upsemcl",
                                 "seed-multiplicator", "seed-quotataire")) {
            if (roles.contains(r)) return r;
        }
        return "inconnu";
    }
}
