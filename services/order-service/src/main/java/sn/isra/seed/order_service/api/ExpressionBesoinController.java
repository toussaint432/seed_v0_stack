package sn.isra.seed.order_service.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.order_service.entity.ExpressionBesoin;
import sn.isra.seed.order_service.entity.enums.StatutExpressionBesoin;
import sn.isra.seed.order_service.repo.ExpressionBesoinRepo;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/expressions-besoins")
@RequiredArgsConstructor
public class ExpressionBesoinController {

    private final ExpressionBesoinRepo repo;
    private final MembreOrganisationRepo membreRepo;

    // ── DTOs internes ────────────────────────────────────────────────────────

    @Getter @Setter
    public static class CreateRequest {
        @NotNull private Long idVariete;
        private String nomVariete;
        private String codeEspece;
        private String nomEspece;
        @NotBlank @Size(max = 30) private String campagneCible;
        @NotNull @DecimalMin("0.01") private BigDecimal quantiteSouhaitee;
        private String unite;
        private String observations;
    }

    @Getter @Setter
    public static class PrendreEnCompteRequest {
        private String observations;
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    /** Multiplicateur : déclarer un besoin */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpressionBesoin create(
            @Valid @RequestBody CreateRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!hasRole(jwt, "seed-multiplicator"))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé aux multiplicateurs");

        String username = jwt.getClaimAsString("preferred_username");
        var eb = new ExpressionBesoin();
        eb.setIdVariete(req.getIdVariete());
        eb.setNomVariete(req.getNomVariete());
        eb.setCodeEspece(req.getCodeEspece());
        eb.setNomEspece(req.getNomEspece());
        eb.setCampagneCible(req.getCampagneCible());
        eb.setQuantiteSouhaitee(req.getQuantiteSouhaitee());
        eb.setUnite(req.getUnite() != null && !req.getUnite().isBlank() ? req.getUnite() : "kg");
        eb.setObservations(req.getObservations());
        eb.setUsernameCreateur(username);

        membreRepo.findByKeycloakUsername(username).ifPresent(m -> {
            eb.setNomCompletCreateur(m.getNomComplet());
            if (m.getOrganisation() != null) {
                eb.setIdOrganisation(m.getOrganisation().getId());
                eb.setNomOrganisation(m.getOrganisation().getNomOrganisation());
            }
        });

        return repo.save(eb);
    }

    /** Multiplicateur : voir ses propres déclarations */
    @GetMapping("/mes-besoins")
    public List<ExpressionBesoin> mesBesoin(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String username = jwt.getClaimAsString("preferred_username");
        return repo.findByUsernameCreateurOrderByCreatedAtDesc(username);
    }

    /** UPSemCL / Admin : vue agrégée par variété + campagne */
    @GetMapping("/agregees")
    public List<Map<String, Object>> agregees(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!hasRole(jwt, "seed-upsemcl") && !hasRole(jwt, "seed-admin") && !hasRole(jwt, "seed-selector"))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);

        return repo.findAgregeesRaw().stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("idVariete",       row[0]);
            m.put("nomVariete",      row[1]);
            m.put("codeEspece",      row[2]);
            m.put("nomEspece",       row[3]);
            m.put("campagneCible",   row[4]);
            m.put("totalKg",         row[5]);
            m.put("nbDemandeurs",    row[6]);
            return m;
        }).toList();
    }

    /** UPSemCL / Admin : liste détaillée de tous les besoins actifs */
    @GetMapping
    public List<ExpressionBesoin> listAll(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!hasRole(jwt, "seed-upsemcl") && !hasRole(jwt, "seed-admin") && !hasRole(jwt, "seed-selector"))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return repo.findAllActives();
    }

    /** UPSemCL : prendre en compte un besoin */
    @PutMapping("/{id}/prendre-en-compte")
    public ExpressionBesoin prendreEnCompte(
            @PathVariable Long id,
            @RequestBody(required = false) PrendreEnCompteRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!hasRole(jwt, "seed-upsemcl") && !hasRole(jwt, "seed-admin"))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);

        var eb = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (eb.getStatut() == StatutExpressionBesoin.ANNULEE)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Besoin déjà annulé");

        eb.setStatut(StatutExpressionBesoin.PRISE_EN_COMPTE);
        if (req != null && req.getObservations() != null && !req.getObservations().isBlank())
            eb.setObservations(req.getObservations());
        return repo.save(eb);
    }

    /** Multiplicateur : annuler sa propre déclaration */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> annuler(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String username = jwt.getClaimAsString("preferred_username");
        var eb = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        boolean isOwner = eb.getUsernameCreateur().equals(username);
        boolean isAdmin  = hasRole(jwt, "seed-admin") || hasRole(jwt, "seed-upsemcl");
        if (!isOwner && !isAdmin)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);

        eb.setStatut(StatutExpressionBesoin.ANNULEE);
        repo.save(eb);
        return ResponseEntity.noContent().build();
    }

    /** Badge count — besoins SOUMISE en attente pour UPSemCL */
    @GetMapping("/alerts/count")
    public Map<String, Long> alertsCount(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return Map.of("count", 0L);
        if (!hasRole(jwt, "seed-upsemcl") && !hasRole(jwt, "seed-admin"))
            return Map.of("count", 0L);
        return Map.of("count", repo.countSoumises());
    }

    // ── Helper rôles ─────────────────────────────────────────────────────────
    private boolean hasRole(Jwt jwt, String role) {
        try {
            Map<String, Object> ra = jwt.getClaim("realm_access");
            if (ra == null) return false;
            Object roles = ra.get("roles");
            if (roles instanceof List<?> list) return list.contains(role);
        } catch (Exception ignored) {}
        return false;
    }
}
