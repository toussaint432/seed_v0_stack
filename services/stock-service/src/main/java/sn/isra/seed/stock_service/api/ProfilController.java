package sn.isra.seed.stock_service.api;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Expose le profil de l'utilisateur connecté (nom, téléphone, localité)
 * depuis la table membre_organisation — username extrait du JWT côté serveur.
 */
@RestController
@RequestMapping("/api/profil")
@RequiredArgsConstructor
public class ProfilController {

    private final JdbcTemplate jdbc;

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMonProfil(
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) return ResponseEntity.status(401).build();

        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) return ResponseEntity.status(401).build();

        var rows = jdbc.queryForList("""
            SELECT
                mo.nom_complet      AS "nomComplet",
                mo.telephone        AS "telephone",
                mo.localite         AS "localite",
                mo.keycloak_role    AS "roleKey",
                o.nom_organisation  AS "nomOrganisation"
            FROM shared.membre_organisation mo
            LEFT JOIN shared.organisation o ON o.id = mo.id_organisation
            WHERE mo.keycloak_username = ?
            LIMIT 1
            """, username);

        if (rows.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                "nomComplet", jwt.getClaimAsString("preferred_username"),
                "telephone", "",
                "localite", "",
                "roleKey", "",
                "nomOrganisation", ""
            ));
        }

        return ResponseEntity.ok(rows.get(0));
    }
}
