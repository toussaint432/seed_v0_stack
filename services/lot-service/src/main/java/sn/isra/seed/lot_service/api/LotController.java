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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

        // Isolation multiplicateur : lots produits + lots reçus via transfert accepté
        if (roles.contains("seed-multiplicator")) {
            Object orgClaim = jwt != null ? jwt.getClaim("org_id") : null;
            String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
            if (orgClaim != null && username != null) {
                try {
                    Long orgId = Long.parseLong(orgClaim.toString());
                    return lotRepo.findMesLots(orgId, username);
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
            // Auto-résolution de l'organisation productrice depuis le claim JWT
            if (lot.getIdOrgProducteur() == null) {
                Object orgClaim = jwt.getClaim("org_id");
                if (orgClaim != null) {
                    try { lot.setIdOrgProducteur(Long.parseLong(orgClaim.toString())); }
                    catch (NumberFormatException ignored) {}
                }
            }
        }
        // Charger la génération complète (pas un proxy) — sera réinjectée après save
        Generation resolvedGen = null;
        if (lot.getGeneration() != null && lot.getGeneration().getId() != null)
            resolvedGen = generationRepo.findById(lot.getGeneration().getId()).orElse(null);
        if (resolvedGen != null) lot.setGeneration(resolvedGen);

        // Valeurs par défaut pour les champs @NotBlank/@NotNull
        if (lot.getUnite() == null || lot.getUnite().isBlank()) lot.setUnite("kg");
        if (lot.getStatutLot() == null) lot.setStatutLot(StatutLot.DISPONIBLE);

        LotSemencier saved = lotRepo.save(lot);
        // save() peut remplacer generation par un proxy bytecode → on réinjecte l'entité pleine
        if (resolvedGen != null) saved.setGeneration(resolvedGen);
        producer.lotCreated(om.writeValueAsString(saved));
        return saved;
    }

    // ── Créer un lot enfant (G1 depuis G0, G2 depuis G1…) ────
    @Transactional
    @PostMapping("/{id}/child")
    public LotSemencier createChild(@PathVariable Long id,
                                     @RequestBody CreateChildLotRequest req,
                                     @AuthenticationPrincipal Jwt jwt) throws Exception {
        LotSemencier parent = lotRepo.findById(id).orElseThrow();
        Generation gen = generationRepo.findByCodeGeneration(req.generationCode()).orElseThrow();

        LotSemencier child = new LotSemencier();
        child.setCodeLot(req.codeLot());
        child.setIdVariete(req.idVariete() != null ? req.idVariete() : parent.getIdVariete());
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

        // Champs production PCAE
        child.setSuperficieHa(req.superficieHa());
        child.setProductionBruteKg(req.productionBruteKg());
        child.setCycle(req.cycle());
        child.setNiveauSemence(req.niveauSemence());
        child.setQuantiteSemenceSrcKg(req.quantiteSemenceSrcKg());

        // Calcul automatique du rendement si les deux valeurs sont présentes
        if (req.superficieHa() != null && req.productionBruteKg() != null
                && req.superficieHa().compareTo(BigDecimal.ZERO) > 0) {
            child.setRendementKgHa(req.productionBruteKg()
                    .divide(req.superficieHa(), 2, RoundingMode.HALF_UP));
        }

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
            // Priorité : valeur explicite de la requête, sinon org du JWT connecté
            if (req.idOrgProducteur() != null) {
                child.setIdOrgProducteur(req.idOrgProducteur());
            } else {
                Object orgClaim = jwt.getClaim("org_id");
                if (orgClaim != null) {
                    try { child.setIdOrgProducteur(Long.parseLong(orgClaim.toString())); }
                    catch (NumberFormatException ignored) {}
                }
            }
        }

        LotSemencier saved = lotRepo.save(child);

        // Débiter la quantité nette du lot parent si quantiteSemenceSrcKg fournie
        if (req.quantiteSemenceSrcKg() != null
                && req.quantiteSemenceSrcKg().compareTo(BigDecimal.ZERO) > 0) {
            lotRepo.debitQuantiteNette(parent.getId(), req.quantiteSemenceSrcKg());
        }

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

        BigDecimal quantiteTransfert = (qte instanceof Number)
                ? new BigDecimal(qte.toString()) : null;

        // Validation métier : quantité obligatoire et ≤ stock disponible
        if (quantiteTransfert == null || quantiteTransfert.compareTo(BigDecimal.ZERO) <= 0)
            return ResponseEntity.badRequest().body(
                Map.of("message", "La quantité à transférer doit être strictement positive"));

        if (lot.getQuantiteNette() != null
                && quantiteTransfert.compareTo(lot.getQuantiteNette()) > 0)
            return ResponseEntity.badRequest().body(
                Map.of("message", "Quantité insuffisante : disponible "
                    + lot.getQuantiteNette().toPlainString()
                    + " " + (lot.getUnite() != null ? lot.getUnite() : "kg")
                    + ", demandé " + quantiteTransfert.toPlainString()));

        TransfertLot t = new TransfertLot();
        t.setCodeTransfert("TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        t.setIdLot(id);
        t.setUsernameEmetteur(usernameEmetteur);
        t.setRoleEmetteur(roleEmetteur);
        t.setUsernameDestinataire(usernameDestinataire);
        t.setRoleDestinataire(roleDestinataire);
        t.setGenerationTransferee(gen);
        t.setObservations(observations);
        t.setQuantite(quantiteTransfert);

        TransfertLot saved = transfertRepo.save(t);

        // ── Réservation immédiate : débit de la quantité sur le lot source ──
        // Le statut TRANSFERE est posé uniquement si tout le lot est parti.
        // Pour un transfert partiel la quantite_nette restante reste DISPONIBLE.
        StatutLot ancienStatut = lot.getStatutLot();
        BigDecimal restant = lot.getQuantiteNette() != null
                ? lot.getQuantiteNette().subtract(quantiteTransfert)
                : BigDecimal.ZERO;
        lot.setQuantiteNette(restant.compareTo(BigDecimal.ZERO) >= 0 ? restant : BigDecimal.ZERO);
        StatutLot nouveauStatut = restant.compareTo(BigDecimal.ZERO) <= 0
                ? StatutLot.TRANSFERE : ancienStatut;
        lot.setStatutLot(nouveauStatut);
        lotRepo.save(lot);

        historiqueRepo.save(HistoriqueStatutLot.of(
            id,
            ancienStatut,
            nouveauStatut,
            usernameEmetteur,
            "Transfert " + gen + " — " + quantiteTransfert.toPlainString() + " kg"
                + " vers " + usernameDestinataire
                + " [" + roleDestinataire + "] — code: " + saved.getCodeTransfert()
                + (restant.compareTo(BigDecimal.ZERO) > 0
                    ? " — restant: " + restant.toPlainString() + " kg" : " (lot complet)")
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

    // ── Lots propres au multiplicateur connecté + reçus via transfert ────────
    @GetMapping("/mes-lots")
    public ResponseEntity<List<LotSemencier>> mesLots(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(401).build();
        Object orgClaim = jwt.getClaim("org_id");
        String username = jwt.getClaimAsString("preferred_username");
        if (orgClaim == null || username == null)
            return ResponseEntity.ok(List.of());
        Long orgId;
        try { orgId = Long.parseLong(orgClaim.toString()); }
        catch (NumberFormatException e) { return ResponseEntity.badRequest().build(); }
        return ResponseEntity.ok(lotRepo.findMesLots(orgId, username));
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
