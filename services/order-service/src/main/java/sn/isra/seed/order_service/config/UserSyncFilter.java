package sn.isra.seed.order_service.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import sn.isra.seed.order_service.entity.MembreOrganisation;
import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.OrganisationRepo;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Synchronisation automatique Keycloak → membre_organisation.
 *
 * À chaque requête authentifiée, si l'utilisateur du JWT n'existe pas encore
 * dans la table membre_organisation, il est créé automatiquement.
 *
 * Organisation par défaut selon le rôle :
 *   seed-admin / seed-selector  → première org ISRA
 *   seed-upsemcl                → première org UPSEMCL
 *   seed-multiplicator          → première org MULTIPLICATEUR
 *   seed-quotataire             → première org OP
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserSyncFilter extends OncePerRequestFilter {

    private final MembreOrganisationRepo membreRepo;
    private final OrganisationRepo       orgRepo;

    private static final Map<String, String> ROLE_ORG_TYPE = Map.of(
        "seed-admin",         "ISRA",
        "seed-selector",      "ISRA",
        "seed-upsemcl",       "UPSEMCL",
        "seed-multiplicator", "MULTIPLICATEUR",
        "seed-quotataire",    "OP"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                Jwt jwt = (Jwt) jwtAuth.getPrincipal();
                String username = jwt.getClaimAsString("preferred_username");

                if (username != null && !membreRepo.existsByKeycloakUsername(username)) {
                    String role = extractSeedRole(jwt);
                    Organisation org = findDefaultOrg(role);
                    if (org != null) {
                        autoRegister(username, role, jwt, org);
                        log.info("[UserSync] '{}' → rôle='{}' org='{}'",
                                 username, role, org.getNomOrganisation());
                    }
                }
            }
        } catch (Exception e) {
            // Jamais bloquer la requête pour une erreur de sync
            log.warn("[UserSync] Erreur non bloquante : {}", e.getMessage());
        }
        chain.doFilter(request, response);
    }

    private String extractSeedRole(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return "seed-quotataire";
        Object roles = realmAccess.get("roles");
        if (!(roles instanceof List<?> list)) return "seed-quotataire";
        return list.stream()
                   .map(Object::toString)
                   .filter(r -> r.startsWith("seed-"))
                   .findFirst()
                   .orElse("seed-quotataire");
    }

    private Organisation findDefaultOrg(String role) {
        String type = ROLE_ORG_TYPE.getOrDefault(role, "OP");
        List<Organisation> orgs = orgRepo.findByTypeOrganisation(type);
        if (!orgs.isEmpty()) return orgs.get(0);
        List<Organisation> all = orgRepo.findAll();
        return all.isEmpty() ? null : all.get(0);
    }

    private void autoRegister(String username, String role, Jwt jwt, Organisation org) {
        String firstName = jwt.getClaimAsString("given_name");
        String lastName  = jwt.getClaimAsString("family_name");

        String nomComplet;
        if (firstName != null || lastName != null) {
            nomComplet = ((firstName != null ? firstName : "")
                       + " "
                       + (lastName  != null ? lastName  : "")).trim();
        } else {
            nomComplet = Character.toUpperCase(username.charAt(0)) + username.substring(1);
        }

        MembreOrganisation m = new MembreOrganisation();
        m.setKeycloakUsername(username);
        m.setKeycloakRole(role);
        m.setNomComplet(nomComplet);
        m.setOrganisation(org);
        membreRepo.save(m);
    }
}
