package sn.isra.seed.stock_service.repo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Résolution de l'id_organisation via la table membre_organisation (partagée).
 * Le JWT Keycloak ne contient pas de claim org_id — on fait un lookup SQL en fallback.
 * Même pattern que MembreOrgLotRepo dans le lot-service.
 */
@Repository
@RequiredArgsConstructor
public class MembreOrgStockRepo {

    private final JdbcTemplate jdbc;

    public Optional<Long> findOrgIdByUsername(String username) {
        if (username == null || username.isBlank()) return Optional.empty();
        List<Long> rows = jdbc.query(
            "SELECT id_organisation FROM membre_organisation WHERE keycloak_username = ? LIMIT 1",
            (rs, i) -> rs.getLong("id_organisation"),
            username
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<String> findOrgCodeById(Long orgId) {
        if (orgId == null) return Optional.empty();
        List<String> rows = jdbc.query(
            "SELECT code_organisation FROM organisation WHERE id = ? LIMIT 1",
            (rs, i) -> rs.getString("code_organisation"),
            orgId
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }
}
