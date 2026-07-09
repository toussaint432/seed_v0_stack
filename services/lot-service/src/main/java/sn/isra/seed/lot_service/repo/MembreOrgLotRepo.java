package sn.isra.seed.lot_service.repo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Accès en lecture seule à la table membre_organisation (partagée entre micro-services).
 * Utilisé pour résoudre l'id_organisation d'un utilisateur Keycloak lors de la création
 * d'un lot, quand le JWT ne contient pas de claim org_id.
 *
 * JdbcTemplate évite la nécessité d'une entité JPA dédiée pour cette table partagée.
 */
@Repository
@RequiredArgsConstructor
public class MembreOrgLotRepo {

    private final JdbcTemplate jdbc;

    /**
     * Retourne l'id_organisation du membre identifié par son username Keycloak.
     * Retourne Optional.empty() si l'utilisateur n'est pas dans membre_organisation.
     */
    public Optional<Long> findOrgIdByUsername(String username) {
        if (username == null || username.isBlank()) return Optional.empty();
        List<Long> rows = jdbc.query(
            "SELECT id_organisation FROM membre_organisation WHERE keycloak_username = ? LIMIT 1",
            (rs, i) -> rs.getLong("id_organisation"),
            username
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }
}
