package sn.isra.seed.common.util;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;

public final class JwtHelper {

    private static final List<String> SEED_ROLES = List.of(
        "seed-admin", "seed-selector", "seed-upsemcl", "seed-multiplicator", "seed-quotataire"
    );

    private JwtHelper() {}

    @SuppressWarnings("unchecked")
    public static List<String> extractRoles(Jwt jwt) {
        if (jwt == null) return List.of();
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return List.of();
        Object roles = realmAccess.get("roles");
        if (roles instanceof List<?>) return (List<String>) roles;
        return List.of();
    }

    public static boolean hasRole(Jwt jwt, String role) {
        return extractRoles(jwt).contains(role);
    }

    public static String getUsername(Jwt jwt) {
        return jwt == null ? null : jwt.getClaimAsString("preferred_username");
    }

    public static String detectSeedRole(Jwt jwt) {
        List<String> roles = extractRoles(jwt);
        return SEED_ROLES.stream().filter(roles::contains).findFirst().orElse("inconnu");
    }

    public static Long resolveOrgIdFromClaim(Jwt jwt) {
        if (jwt == null) return null;
        Object orgClaim = jwt.getClaim("org_id");
        if (orgClaim != null) {
            try { return Long.parseLong(orgClaim.toString()); }
            catch (NumberFormatException ignored) {}
        }
        return null;
    }
}
