package sn.isra.seed.common.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.common.util.JwtHelper;

/**
 * Contexte de l'acteur résolu depuis le JWT Keycloak.
 *
 * Règle de sécurité fondamentale :
 *   - username  : extrait du JWT signé (preferred_username) — impossible à falsifier
 *   - idOrg     : résolu côté serveur via lookup DB — jamais accepté depuis le client
 *   - role      : extrait du JWT signé (realm_access.roles)
 *
 * Usage dans un contrôleur :
 *   ActeurContext acteur = ActeurContext.from(jwt);
 *   Long idOrg = acteur.resolveOrgId(membreRepo);  // lookup DB sécurisé
 */
public record ActeurContext(String username, String role) {

    public static ActeurContext from(Jwt jwt) {
        String username = JwtHelper.getUsername(jwt);
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Token JWT invalide : preferred_username absent");
        }
        return new ActeurContext(username, JwtHelper.detectSeedRole(jwt));
    }

    /**
     * Résout l'id_organisation depuis la base — source de vérité applicative.
     * Lance 403 si l'utilisateur n'est rattaché à aucune organisation.
     */
    public <M extends MembreOrgProjection> Long resolveOrgId(MembreOrgLookup<M> repo) {
        return repo.findByKeycloakUsername(username)
            .map(MembreOrgProjection::getIdOrganisation)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Utilisateur '" + username + "' non rattaché à une organisation"));
    }

    public interface MembreOrgProjection {
        Long getIdOrganisation();
    }

    @FunctionalInterface
    public interface MembreOrgLookup<M extends MembreOrgProjection> {
        java.util.Optional<M> findByKeycloakUsername(String username);
    }
}
