package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.entity.MembreOrganisation;
import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.OrganisationRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/membres")
@RequiredArgsConstructor
@Slf4j
public class MembreController {

    private final MembreOrganisationRepo membreRepo;
    private final OrganisationRepo organisationRepo;
    private final ObjectMapper objectMapper;

    @Value("${keycloak.admin.url:http://keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.admin.username:admin}")
    private String keycloakAdminUsername;

    @Value("${keycloak.admin.password:admin}")
    private String keycloakAdminPassword;

    @Value("${keycloak.admin.realm:seed-v0}")
    private String keycloakRealm;

    /**
     * GET /api/membres/me — profil + organisation du connecté.
     * Utilisé par le frontend pour résoudre org_id sans claim JWT custom.
     * Retourne 404 si l'utilisateur n'est pas encore rattaché à une organisation.
     */
    @GetMapping("/me")
    public ResponseEntity<MembreOrganisation> me(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(401).build();
        String username = jwt.getClaimAsString("preferred_username");
        return membreRepo.findByKeycloakUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Liste tous les membres, avec filtre optionnel par rôle Keycloak */
    @GetMapping
    public List<MembreOrganisation> list(
            @RequestParam(required = false) String role) {
        if (role != null && !role.isBlank())
            return membreRepo.findByKeycloakRole(role);
        return membreRepo.findAll();
    }

    /** Résoudre un username Keycloak → profil + organisation */
    @GetMapping("/username/{username}")
    public ResponseEntity<MembreOrganisation> getByUsername(@PathVariable String username) {
        return membreRepo.findByKeycloakUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Liste des membres d'une organisation */
    @GetMapping("/organisation/{orgId}")
    public List<MembreOrganisation> byOrganisation(@PathVariable Long orgId) {
        return membreRepo.findByOrganisation_Id(orgId);
    }

    /** Créer un membre (lier un compte Keycloak à une organisation) */
    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PostMapping
    public MembreOrganisation create(@RequestBody CreateMembreRequest req) {
        Organisation org = organisationRepo.findById(req.idOrganisation())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Organisation introuvable : " + req.idOrganisation()));

        // Vérifier unicité username
        if (membreRepo.findByKeycloakUsername(req.keycloakUsername()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce username est déjà lié à une organisation");
        }

        MembreOrganisation m = new MembreOrganisation();
        m.setKeycloakUsername(req.keycloakUsername());
        m.setKeycloakRole(req.keycloakRole());
        m.setNomComplet(req.nomComplet());
        m.setOrganisation(org);
        m.setRoleDansOrg(req.roleDansOrg());
        m.setPrincipal(req.principal() != null ? req.principal() : false);
        m.setTelephone(req.telephone());
        m.setSpecialisation(req.specialisation());
        return membreRepo.save(m);
    }

    /** Mettre à jour un membre */
    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PutMapping("/{id}")
    public ResponseEntity<MembreOrganisation> update(@PathVariable Long id,
                                                      @RequestBody CreateMembreRequest req) {
        return membreRepo.findById(id).map(m -> {
            if (req.nomComplet() != null) m.setNomComplet(req.nomComplet());
            if (req.roleDansOrg() != null) m.setRoleDansOrg(req.roleDansOrg());
            if (req.principal() != null) m.setPrincipal(req.principal());
            if (req.telephone() != null) m.setTelephone(req.telephone());
            if (req.idOrganisation() != null) {
                Organisation org = organisationRepo.findById(req.idOrganisation())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
                m.setOrganisation(org);
            }
            return ResponseEntity.ok(membreRepo.save(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * PATCH /api/membres/mon-profil — le membre connecté met à jour son téléphone
     * et sa visibilité (public = visible aux autres rôles, privé = uniquement lui).
     */
    @PatchMapping("/mon-profil")
    public ResponseEntity<MembreOrganisation> updateMonProfil(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ProfilPatch body) {
        if (jwt == null) return ResponseEntity.status(401).build();
        String username = jwt.getClaimAsString("preferred_username");
        return membreRepo.findByKeycloakUsername(username).map(m -> {
            if (body.telephone() != null) m.setTelephone(body.telephone());
            if (body.telephonePublic() != null) m.setTelephonePublic(body.telephonePublic());
            return ResponseEntity.ok(membreRepo.save(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** DTO pour création/mise à jour */
    public record CreateMembreRequest(
            String keycloakUsername,
            String keycloakRole,
            String nomComplet,
            Long idOrganisation,
            String roleDansOrg,
            Boolean principal,
            String telephone,
            String specialisation
    ) {}

    record ProfilPatch(String telephone, Boolean telephonePublic) {}

    /**
     * POST /api/membres/keycloak-profil — met à jour le profil via l'Admin REST API Keycloak.
     * Stratégie : GET représentation complète → merger les champs → PUT complet.
     * Vérifie l'unicité du username avant de persister.
     */
    @SuppressWarnings("unchecked")
    @PostMapping("/keycloak-profil")
    public ResponseEntity<Map<String, String>> updateKeycloakProfil(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody KeycloakProfilDto body) {
        if (jwt == null) return ResponseEntity.status(401).build();
        String userId = jwt.getSubject();
        try {
            String adminToken = fetchAdminToken();
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

            // 1. Vérifier l'unicité du nouveau username si changé
            if (body.username() != null && !body.username().isBlank()) {
                String newUsername     = body.username().toLowerCase().trim();
                String currentUsername = jwt.getClaimAsString("preferred_username");
                if (!newUsername.equals(currentUsername)) {
                    HttpRequest checkReq = HttpRequest.newBuilder()
                        .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                            + "/users?username=" + URLEncoder.encode(newUsername, StandardCharsets.UTF_8) + "&exact=true"))
                        .header("Authorization", "Bearer " + adminToken)
                        .GET().timeout(Duration.ofSeconds(10)).build();
                    HttpResponse<String> checkResp = client.send(checkReq, HttpResponse.BodyHandlers.ofString());
                    java.util.List<?> existing = objectMapper.readValue(checkResp.body(), java.util.List.class);
                    if (!existing.isEmpty()) {
                        return ResponseEntity.status(409)
                            .body(Map.of("errorMessage", "Ce nom d'utilisateur est déjà utilisé, veuillez en choisir un autre"));
                    }
                }
            }

            // 2. S'assurer que le User Profile Keycloak autorise l'écriture du username
            if (body.username() != null && !body.username().isBlank()) {
                ensureUsernameEditable(adminToken, client);
            }

            // 3. Récupérer la représentation complète de l'utilisateur
            HttpRequest getReq = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm + "/users/" + userId))
                .header("Authorization", "Bearer " + adminToken)
                .GET().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> getResp = client.send(getReq, HttpResponse.BodyHandlers.ofString());
            java.util.Map<String, Object> userRep = new java.util.HashMap<>(
                objectMapper.readValue(getResp.body(), java.util.Map.class));

            // 3. Merger uniquement les champs fournis
            if (body.firstName() != null) userRep.put("firstName", body.firstName());
            if (body.lastName()  != null) userRep.put("lastName",  body.lastName());
            if (body.email()     != null) userRep.put("email",     body.email());
            if (body.username()  != null && !body.username().isBlank())
                userRep.put("username", body.username().toLowerCase().trim());

            // 4. PUT la représentation complète
            HttpRequest putReq = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm + "/users/" + userId))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + adminToken)
                .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(userRep)))
                .timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> putResp = client.send(putReq, HttpResponse.BodyHandlers.ofString());

            if (putResp.statusCode() >= 400) {
                log.warn("[keycloak-profil] Admin API → HTTP {}: {}", putResp.statusCode(), putResp.body());
                String errMsg;
                try {
                    java.util.Map<String, Object> errBody = objectMapper.readValue(putResp.body(), java.util.Map.class);
                    Object msg = errBody.get("errorMessage");
                    errMsg = msg != null ? msg.toString() : "Erreur Keycloak " + putResp.statusCode();
                } catch (Exception ex) {
                    errMsg = "Erreur lors de la mise à jour (HTTP " + putResp.statusCode() + ")";
                }
                return ResponseEntity.status(putResp.statusCode()).body(Map.of("errorMessage", errMsg));
            }

            // Sync immédiat membre_organisation.nom_complet après succès Keycloak
            String currentUsername = jwt.getClaimAsString("preferred_username");
            membreRepo.findByKeycloakUsername(currentUsername).ifPresent(m -> {
                String fn = body.firstName() != null ? body.firstName().trim() : "";
                String ln = body.lastName()  != null ? body.lastName().trim()  : "";
                String nouveau = (fn + " " + ln).trim();
                if (!nouveau.isEmpty()) {
                    m.setNomComplet(nouveau);
                    membreRepo.save(m);
                    log.info("[keycloak-profil] nom_complet mis à jour en base pour '{}'", currentUsername);
                }
            });

            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("[keycloak-profil] Erreur : {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("errorMessage", "Erreur serveur lors de la mise à jour"));
        }
    }

    /**
     * Double patch nécessaire en Keycloak 23+ :
     * 1. editUsernameAllowed au niveau realm (gate primaire — bloque même l'Admin API)
     * 2. permissions.edit du User Profile pour l'attribut username (gate secondaire)
     */
    @SuppressWarnings("unchecked")
    private void ensureUsernameEditable(String adminToken, HttpClient client) {
        // --- Gate 1 : realm.editUsernameAllowed ---
        try {
            HttpRequest getReq = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm))
                .header("Authorization", "Bearer " + adminToken)
                .GET().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> getResp = client.send(getReq, HttpResponse.BodyHandlers.ofString());
            if (getResp.statusCode() == 200) {
                java.util.Map<String, Object> realm =
                    new java.util.HashMap<>(objectMapper.readValue(getResp.body(), java.util.Map.class));
                if (!Boolean.TRUE.equals(realm.get("editUsernameAllowed"))) {
                    realm.put("editUsernameAllowed", true);
                    HttpRequest putReq = HttpRequest.newBuilder()
                        .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + adminToken)
                        .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(realm)))
                        .timeout(Duration.ofSeconds(15)).build();
                    HttpResponse<String> putResp = client.send(putReq, HttpResponse.BodyHandlers.ofString());
                    if (putResp.statusCode() < 300)
                        log.info("[keycloak-profil] Realm patché : editUsernameAllowed activé");
                    else
                        log.warn("[keycloak-profil] Échec patch realm : HTTP {} — {}", putResp.statusCode(), putResp.body());
                }
            }
        } catch (Exception e) {
            log.warn("[keycloak-profil] Impossible de patcher le realm : {}", e.getMessage());
        }

        // --- Gate 2 : User Profile permissions.edit pour username ---
        try {
            HttpRequest getReq = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm + "/users/profile"))
                .header("Authorization", "Bearer " + adminToken)
                .GET().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> getResp = client.send(getReq, HttpResponse.BodyHandlers.ofString());
            if (getResp.statusCode() != 200) return;

            java.util.Map<String, Object> profileConfig =
                new java.util.HashMap<>(objectMapper.readValue(getResp.body(), java.util.Map.class));
            java.util.List<java.util.Map<String, Object>> attributes =
                (java.util.List<java.util.Map<String, Object>>) profileConfig.get("attributes");
            if (attributes == null) return;

            boolean modified = false;
            for (java.util.Map<String, Object> attr : attributes) {
                if (!"username".equals(attr.get("name"))) continue;
                java.util.Map<String, Object> perms = (java.util.Map<String, Object>)
                    attr.computeIfAbsent("permissions", k -> new java.util.HashMap<>());
                java.util.List<String> editList = (java.util.List<String>)
                    perms.computeIfAbsent("edit", k -> new java.util.ArrayList<>());
                if (!editList.contains("admin")) { editList.add("admin"); modified = true; }
                if (!editList.contains("user"))  { editList.add("user");  modified = true; }
                break;
            }

            if (modified) {
                HttpRequest putReq = HttpRequest.newBuilder()
                    .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm + "/users/profile"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + adminToken)
                    .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(profileConfig)))
                    .timeout(Duration.ofSeconds(10)).build();
                client.send(putReq, HttpResponse.BodyHandlers.ofString());
                log.info("[keycloak-profil] User Profile patché : username inscriptible");
            }
        } catch (Exception e) {
            log.warn("[keycloak-profil] Impossible de patcher le User Profile : {}", e.getMessage());
        }
    }

    private String fetchAdminToken() throws Exception {
        String form = "grant_type=password&client_id=admin-cli"
            + "&username=" + URLEncoder.encode(keycloakAdminUsername, StandardCharsets.UTF_8)
            + "&password=" + URLEncoder.encode(keycloakAdminPassword, StandardCharsets.UTF_8);
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(keycloakUrl + "/realms/master/protocol/openid-connect/token"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .timeout(Duration.ofSeconds(10))
            .build();
        HttpResponse<String> response = client.send(req, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200)
            throw new RuntimeException("Token admin Keycloak refusé : HTTP " + response.statusCode());
        Map<?, ?> tokenBody = objectMapper.readValue(response.body(), Map.class);
        return (String) tokenBody.get("access_token");
    }

    record KeycloakProfilDto(String firstName, String lastName, String email, String username) {}
}
