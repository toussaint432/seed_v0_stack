package sn.isra.seed.stock_service.api;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Fournit la liste des utilisateurs de la plateforme avec leurs coordonnées GPS
 * pour affichage sur la carte du dashboard. La visibilité est filtrée par rôle (RBAC).
 *
 * Règles de visibilité :
 *   admin         → voit selector + upsemcl + multiplicator + quotataire
 *   upsemcl       → voit selector + multiplicator + quotataire
 *   selector      → voit upsemcl + multiplicator + quotataire
 *   multiplicator → voit upsemcl + quotataire
 *   quotataire    → voit multiplicator uniquement
 */
@RestController
@RequestMapping("/api/membres")
@RequiredArgsConstructor
public class MembreCarteController {

    private final JdbcTemplate jdbc;

    @GetMapping("/carte")
    public ResponseEntity<List<Map<String, Object>>> getCarte(
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        Optional<String> viewerRole = findRoleByUsername(username);
        if (viewerRole.isEmpty()) return ResponseEntity.ok(List.of());

        List<String> visibleRoles = getVisibleRoles(viewerRole.get());
        if (visibleRoles.isEmpty()) return ResponseEntity.ok(List.of());

        String placeholders = visibleRoles.stream().map(r -> "?").collect(Collectors.joining(", "));

        String sql = String.format("""
            SELECT
                m.keycloak_username                              AS username,
                m.nom_complet                                    AS "nomComplet",
                m.keycloak_role                                  AS role,
                o.nom_organisation                               AS "nomOrganisation",
                o.type_organisation                              AS "typeOrganisation",
                COALESCE(
                    (SELECT s.latitude  FROM stock.site s
                     WHERE s.id_membre = m.id AND s.est_principal = true LIMIT 1),
                    (SELECT s.latitude  FROM stock.site s
                     WHERE s.id_organisation = o.id AND s.est_principal = true LIMIT 1),
                    o.latitude
                )                                                AS latitude,
                COALESCE(
                    (SELECT s.longitude FROM stock.site s
                     WHERE s.id_membre = m.id AND s.est_principal = true LIMIT 1),
                    (SELECT s.longitude FROM stock.site s
                     WHERE s.id_organisation = o.id AND s.est_principal = true LIMIT 1),
                    o.longitude
                )                                                AS longitude,
                COALESCE(
                    (SELECT s.nom_site  FROM stock.site s
                     WHERE s.id_membre = m.id AND s.est_principal = true LIMIT 1),
                    (SELECT s.nom_site  FROM stock.site s
                     WHERE s.id_organisation = o.id AND s.est_principal = true LIMIT 1),
                    o.nom_organisation
                )                                                AS "nomSite",
                COALESCE(
                    (SELECT s.zone_code FROM stock.site s
                     WHERE s.id_membre = m.id AND s.est_principal = true LIMIT 1),
                    (SELECT s.zone_code FROM stock.site s
                     WHERE s.id_organisation = o.id AND s.est_principal = true LIMIT 1)
                )                                                AS "zoneCode"
            FROM shared.membre_organisation m
            JOIN shared.organisation o ON o.id = m.id_organisation
            WHERE m.keycloak_role IN (%s)
              AND o.active = true
            ORDER BY m.keycloak_role, m.nom_complet
            """, placeholders);

        List<Map<String, Object>> rows = jdbc.queryForList(sql, visibleRoles.toArray());

        List<Map<String, Object>> result = rows.stream()
                .filter(r -> r.get("latitude") != null && r.get("longitude") != null)
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    private Optional<String> findRoleByUsername(String username) {
        if (username == null || username.isBlank()) return Optional.empty();
        List<String> rows = jdbc.query(
                "SELECT keycloak_role FROM shared.membre_organisation WHERE keycloak_username = ? LIMIT 1",
                (rs, i) -> rs.getString("keycloak_role"),
                username
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    private List<String> getVisibleRoles(String viewerRole) {
        return switch (viewerRole) {
            case "seed-admin" ->
                List.of("seed-selector", "seed-upsemcl", "seed-multiplicator", "seed-quotataire");
            case "seed-upsemcl" ->
                List.of("seed-selector", "seed-multiplicator", "seed-quotataire");
            case "seed-selector" ->
                List.of("seed-upsemcl", "seed-multiplicator", "seed-quotataire");
            case "seed-multiplicator" ->
                List.of("seed-upsemcl", "seed-quotataire");
            case "seed-quotataire" ->
                List.of("seed-multiplicator");
            default -> List.of();
        };
    }
}
