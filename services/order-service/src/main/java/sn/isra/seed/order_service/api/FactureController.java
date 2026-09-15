package sn.isra.seed.order_service.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.order_service.entity.*;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.entity.enums.StatutFacture;
import sn.isra.seed.order_service.entity.enums.TypeCommande;
import sn.isra.seed.order_service.entity.enums.TypeFacture;
import sn.isra.seed.order_service.repo.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class FactureController {

    private final CommandeRepo commandeRepo;
    private final FactureRepo factureRepo;
    private final PropositionLigneRepo propositionLigneRepo;
    private final MembreOrganisationRepo membreRepo;
    private final LotQuantiteRepo lotQuantiteRepo;

    /* ══════════════════════════════════════════════════════════════════════
       GÉNÉRATION DE FACTURE
       ══════════════════════════════════════════════════════════════════════ */

    /**
     * POST /api/orders/{id}/generer-facture
     * Génère la facture d'une commande LIVREE à partir des propositions acceptées.
     * Crée une facture idempotente (si elle existe déjà, la renvoie).
     */
    @PreAuthorize("hasAnyAuthority('ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-admin')")
    @Transactional
    @PostMapping("/api/orders/{id}/generer-facture")
    public ResponseEntity<Facture> genererFacture(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        Commande commande = commandeRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande #" + id + " introuvable"));

        if (commande.getStatut() != StatutCommande.LIVREE
                && commande.getStatut() != StatutCommande.TRANSFERE
                && commande.getStatut() != StatutCommande.RECEPTIONNEE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La facture ne peut être générée que pour une commande LIVREE, TRANSFERE ou RECEPTIONNEE (statut actuel : " + commande.getStatut() + ")");
        }

        // Idempotence : renvoyer la facture existante si déjà créée
        List<Facture> existantes = factureRepo.findByCommande_IdOrderByDateEmissionDesc(id);
        if (!existantes.isEmpty()) {
            return ResponseEntity.ok(existantes.get(0));
        }

        String usernameEmetteur = jwt != null ? jwt.getClaimAsString("preferred_username") : "system";
        String observations     = body != null ? body.get("observations") : null;

        TypeFacture typeFacture = commande.getTypeCommande() == TypeCommande.G3_UPSEMCL_MULT
                ? TypeFacture.INSTITUTIONNELLE
                : TypeFacture.MULTIPLICATEUR;

        String numeroFacture = genererNumero(commande, typeFacture);

        Facture facture = new Facture();
        facture.setCommande(commande);
        facture.setNumeroFacture(numeroFacture);
        facture.setTypeFacture(typeFacture);
        facture.setUsernameEmetteur(usernameEmetteur);
        facture.setObservations(observations);
        facture.setStatut(StatutFacture.EMISE);

        BigDecimal totalHt  = BigDecimal.ZERO;
        BigDecimal totalTva = BigDecimal.ZERO;

        for (LigneCommande ligne : commande.getLignes()) {
            propositionLigneRepo.findByLigneCommande_Id(ligne.getId()).ifPresent(prop -> {
                if (prop.getIdLotSelectionne() == null || prop.getQuantiteSelectionnee() == null) return;
                if (prop.getPrixUnitaireHt() == null) return;

                FactureLigne fl = new FactureLigne();
                fl.setFacture(facture);
                fl.setIdLot(prop.getIdLotSelectionne());
                fl.setQuantite(prop.getQuantiteSelectionnee());
                fl.setUnite(ligne.getUnite() != null ? ligne.getUnite() : "kg");
                fl.setPrixUnitaireHt(prop.getPrixUnitaireHt());
                fl.setTauxTva(prop.getTauxTva() != null ? prop.getTauxTva() : BigDecimal.ZERO);

                // Dénormalisation variété depuis lot_semencier si disponible
                lotQuantiteRepo.findById(prop.getIdLotSelectionne()).ifPresent(lot -> {
                    fl.setIdLot(lot.getId());
                });
                fl.setGeneration(ligne.getIdGeneration() != null
                        ? genCode(ligne.getIdGeneration()) : null);
                fl.setCreatedAt(Instant.now());
                BigDecimal tauxTva = fl.getTauxTva() != null ? fl.getTauxTva() : BigDecimal.ZERO;
                BigDecimal montantHt = prop.getPrixUnitaireHt()
                        .multiply(prop.getQuantiteSelectionnee())
                        .setScale(0, RoundingMode.HALF_UP);
                BigDecimal montantTva = montantHt
                        .multiply(tauxTva)
                        .divide(new BigDecimal("100"), 0, RoundingMode.HALF_UP);
                fl.setMontantHt(montantHt);
                fl.setMontantTtc(montantHt.add(montantTva));
                facture.getLignes().add(fl);
            });
        }

        for (FactureLigne fl : facture.getLignes()) {
            BigDecimal ht  = fl.getMontantHt() != null ? fl.getMontantHt() : BigDecimal.ZERO;
            BigDecimal ttc = fl.getMontantTtc() != null ? fl.getMontantTtc() : ht;
            totalHt  = totalHt.add(ht);
            totalTva = totalTva.add(ttc.subtract(ht));
        }

        facture.setMontantHt(totalHt);
        facture.setMontantTva(totalTva);
        facture.setMontantTtc(totalHt.add(totalTva));

        Facture saved = factureRepo.save(facture);
        log.info("Facture {} générée pour commande {} par {}", saved.getNumeroFacture(), id, usernameEmetteur);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    private String genererNumero(Commande commande, TypeFacture typeFacture) {
        String prefix = typeFacture == TypeFacture.INSTITUTIONNELLE ? "FACT-ISRA" : "FACT-MUL";
        String annee  = DateTimeFormatter.ofPattern("yyyy").withZone(java.time.ZoneId.of("Africa/Dakar")).format(Instant.now());
        return prefix + "-" + annee + "-" + commande.getId() + "-" + System.currentTimeMillis() % 10000;
    }

    private String genCode(Long idGeneration) {
        return switch (idGeneration.intValue()) {
            case 1 -> "G0"; case 2 -> "G1"; case 3 -> "G2"; case 4 -> "G3";
            case 5 -> "G4"; case 6 -> "R1"; case 7 -> "R2"; default -> "G" + idGeneration;
        };
    }

    /* ══════════════════════════════════════════════════════════════════════
       CONSULTATION FACTURE
       ══════════════════════════════════════════════════════════════════════ */

    /** GET /api/orders/{id}/facture — Facture associée à une commande */
    @Transactional(readOnly = true)
    @GetMapping("/api/orders/{id}/facture")
    public ResponseEntity<Facture> getFactureParCommande(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        Facture facture = factureRepo.findByCommande_Id(id).orElse(null);
        if (facture == null) return ResponseEntity.notFound().build();
        if (!peutAccederFacture(jwt, facture)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé");
        }
        return ResponseEntity.ok(facture);
    }

    /** GET /api/factures/{id} — Détail d'une facture */
    @Transactional(readOnly = true)
    @GetMapping("/api/factures/{id}")
    public ResponseEntity<Facture> getFacture(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        Facture facture = factureRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facture introuvable"));
        if (!peutAccederFacture(jwt, facture)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé");
        }
        return ResponseEntity.ok(facture);
    }

    private boolean peutAccederFacture(Jwt jwt, Facture facture) {
        if (jwt == null) return false;
        if (hasRole(jwt, "seed-admin") || hasRole(jwt, "seed-upsemcl")) return true;
        String username = jwt.getClaimAsString("preferred_username");
        return membreRepo.findByKeycloakUsername(username).map(m -> {
            Long idOrg = m.getOrganisation().getId();
            Commande cmd = facture.getCommande();
            return idOrg.equals(cmd.getIdOrganisationFournisseur())
                || idOrg.equals(cmd.getIdOrganisationAcheteur());
        }).orElse(false);
    }

    /**
     * GET /api/factures — Liste paginée selon le rôle JWT.
     * - upsemcl / admin → toutes
     * - multiplicateur  → ses propres factures émises
     * - quotataire      → factures reçues (commandes où il est acheteur)
     */
    @Transactional(readOnly = true)
    @GetMapping("/api/factures")
    public Page<Facture> listFactures(
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20) Pageable pageable) {

        if (jwt == null) return Page.empty(pageable);
        String username = jwt.getClaimAsString("preferred_username");

        if (hasRole(jwt, "seed-upsemcl") || hasRole(jwt, "seed-admin")) {
            return factureRepo.findAllByDateDesc(pageable);
        }
        if (hasRole(jwt, "seed-multiplicator")) {
            return membreRepo.findByKeycloakUsername(username)
                    .map(m -> factureRepo.findByOrganisationFournisseur(m.getOrganisation().getId(), pageable))
                    .orElse(Page.empty(pageable));
        }
        if (hasRole(jwt, "seed-quotataire")) {
            return factureRepo.findByAcheteur(username, pageable);
        }
        return Page.empty(pageable);
    }

    /* ══════════════════════════════════════════════════════════════════════
       ACCUSÉ DE RÉCEPTION DE FACTURE (ARF)
       ══════════════════════════════════════════════════════════════════════ */

    /**
     * POST /api/factures/{id}/accuser-reception
     * L'acheteur (multiplicateur ou quotataire) accuse réception de la facture.
     * Statut → ACQUITTEE (RECU) ou inchangé + ARF CONTESTE.
     */
    @PreAuthorize("hasAnyAuthority('ROLE_seed-multiplicator','ROLE_seed-quotataire','ROLE_seed-admin')")
    @Transactional
    @PostMapping("/api/factures/{id}/accuser-reception")
    public ResponseEntity<Facture> accuserReceptionFacture(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        Facture facture = factureRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facture #" + id + " introuvable"));

        if (facture.getAccuseReception() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La facture #" + id + " a déjà un accusé de réception");
        }

        String usernameAcheteur = jwt != null ? jwt.getClaimAsString("preferred_username") : "acheteur";
        String statut       = body != null && "CONTESTE".equals(body.get("statut")) ? "CONTESTE" : "RECU";
        String observations = body != null && body.get("observations") instanceof String s ? s : null;

        AccuseReceptionFacture arf = new AccuseReceptionFacture();
        arf.setFacture(facture);
        arf.setUsernameAcheteur(usernameAcheteur);
        arf.setStatut(statut);
        arf.setObservations(observations);
        arf.setDateAccusee(Instant.now());
        facture.setAccuseReception(arf);

        if ("RECU".equals(statut)) {
            facture.setStatut(StatutFacture.ACQUITTEE);
        } else {
            facture.setStatut(StatutFacture.CONTESTEE);
        }

        Facture saved = factureRepo.save(facture);
        log.info("ARF facture {} : statut {} par {}", id, statut, usernameAcheteur);
        return ResponseEntity.ok(saved);
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
}
