package sn.isra.seed.order_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.order_service.api.dto.AdminInscriptionRequest;
import sn.isra.seed.order_service.api.dto.AdminInscriptionResult;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Orchestrateur SAGA du workflow d'inscription admin atomique.
 *
 * Pattern : Keycloak (Phase 1, externe) → DB @Transactional (Phase 2, SQL)
 * Compensation : si Phase 2 échoue, DELETE Keycloak est appelé pour éviter
 * tout compte fantôme inutilisable sans entrée membre_organisation.
 *
 * Cette classe N'est PAS @Transactional intentionnellement — elle délègue
 * la transaction SQL à AdminInscriptionPersistenceService via proxy AOP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminInscriptionService {

    private final AdminInscriptionPersistenceService persistenceService;
    private final MembreOrganisationRepo             membreRepo;
    private final ObjectMapper                       objectMapper;

    @Value("${keycloak.admin.url:http://keycloak:8080}")
    private String keycloakUrl;

    @Value("${keycloak.admin.username:admin}")
    private String keycloakAdminUsername;

    @Value("${keycloak.admin.password:admin}")
    private String keycloakAdminPassword;

    @Value("${keycloak.admin.realm:seed-v0}")
    private String keycloakRealm;

    private static final String CHARS =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    // ── Point d'entrée public ─────────────────────────────────────────────────

    public AdminInscriptionResult inscrire(AdminInscriptionRequest req) {

        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        // ── Phase 0 : Validation (lecture seule, aucune écriture) ────────────
        valider(req);
        String adminToken = fetchAdminToken(client);
        validerUniciteKeycloak(req.username(), req.email(), adminToken, client);

        // ── Phase 1 : Keycloak (externe, irréversible par Spring) ────────────
        String motDePasse    = genererMotDePasse();
        String keycloakUserId = null;

        try {
            keycloakUserId = creerUtilisateurKeycloak(req, motDePasse, adminToken, client);
            assignerRole(keycloakUserId, req.role(), adminToken, client);
            log.info("[inscription] Compte Keycloak créé : userId={} username='{}'",
                     keycloakUserId, req.username());

        } catch (Exception e) {
            // Keycloak a échoué avant ou pendant la création — rien à compenser en DB
            if (keycloakUserId != null) {
                compenserKeycloak(keycloakUserId, adminToken, client);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Erreur Keycloak lors de la création du compte : " + e.getMessage());
        }

        // ── Phase 2 : Base de données (@Transactional isolé) ─────────────────
        try {
            AdminInscriptionPersistenceService.PersistenceResult db;

            if (req.idOrganisationExistante() == null) {
                // Cas A — nouvelle organisation + site principal + membre
                validerCasA(req);
                db = persistenceService.persisterCasA(req, keycloakUserId);
            } else {
                // Cas B — organisation existante, compte + membre uniquement
                db = persistenceService.persisterCasB(req, keycloakUserId);
            }

            log.info("[inscription] Succès complet : username='{}' org={} site={} membre={}",
                     req.username(), db.idOrganisation(), db.codeSite(), db.idMembre());

            String message = req.idOrganisationExistante() == null
                ? "Inscription Cas A réussie : organisation, site et compte créés."
                : "Inscription Cas B réussie : compte rattaché à l'organisation existante.";

            return new AdminInscriptionResult(
                req.username(),
                motDePasse,
                db.idOrganisation(),
                db.nomOrganisation(),
                db.codeSite(),
                db.idMembre(),
                db.estPrincipal(),
                message
            );

        } catch (Exception e) {
            // Phase 2 échoue → compenser Keycloak pour éviter un compte fantôme
            log.error("[inscription] Échec DB après création Keycloak — compensation en cours : {}",
                      e.getMessage());
            compenserKeycloak(keycloakUserId, adminToken, client);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Inscription annulée proprement (compte Keycloak supprimé) : " + e.getMessage());
        }
    }

    // ── Phase 0 : Validations ─────────────────────────────────────────────────

    private void valider(AdminInscriptionRequest req) {
        // Unicité username en DB (rapide, pas besoin de token Keycloak)
        if (membreRepo.existsByKeycloakUsername(req.username()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Ce username est déjà enregistré dans membre_organisation : " + req.username());

        // Rôle connu
        if (!List.of("seed-multiplicator", "seed-quotataire",
                      "seed-upsemcl", "seed-selector", "seed-admin").contains(req.role()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Rôle inconnu : " + req.role());
    }

    private void validerCasA(AdminInscriptionRequest req) {
        if (req.nomOrganisation() == null || req.nomOrganisation().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cas A : nomOrganisation est obligatoire");
        if (req.typeOrganisation() == null || req.typeOrganisation().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cas A : typeOrganisation est obligatoire");
    }

    @SuppressWarnings("unchecked")
    private void validerUniciteKeycloak(String username, String email,
                                        String adminToken, HttpClient client) {
        try {
            // Vérifier username
            String usernameEnc = URLEncoder.encode(username, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                    + "/users?username=" + usernameEnc + "&exact=true"))
                .header("Authorization", "Bearer " + adminToken)
                .GET().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            List<?> existing = objectMapper.readValue(resp.body(), List.class);
            if (!existing.isEmpty())
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce username existe déjà dans Keycloak : " + username);

            // Vérifier email
            String emailEnc = URLEncoder.encode(email, StandardCharsets.UTF_8);
            HttpRequest reqEmail = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                    + "/users?email=" + emailEnc + "&exact=true"))
                .header("Authorization", "Bearer " + adminToken)
                .GET().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> respEmail = client.send(reqEmail, HttpResponse.BodyHandlers.ofString());
            List<?> existingEmail = objectMapper.readValue(respEmail.body(), List.class);
            if (!existingEmail.isEmpty())
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cet email est déjà utilisé dans Keycloak : " + email);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Impossible de vérifier l'unicité dans Keycloak : " + e.getMessage());
        }
    }

    // ── Phase 1 : Keycloak ────────────────────────────────────────────────────

    private String creerUtilisateurKeycloak(AdminInscriptionRequest req,
                                             String motDePasse,
                                             String adminToken,
                                             HttpClient client) throws Exception {
        Map<String, Object> userRep = Map.of(
            "username",       req.username(),
            "email",          req.email(),
            "firstName",      req.prenom().trim(),
            "lastName",       req.nom().trim(),
            "enabled",        true,
            "emailVerified",  true,
            "requiredActions", List.of("UPDATE_PASSWORD"),
            "credentials", List.of(Map.of(
                "type",      "password",
                "value",     motDePasse,
                "temporary", true
            ))
        );

        HttpRequest postReq = HttpRequest.newBuilder()
            .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm + "/users"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + adminToken)
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(userRep)))
            .timeout(Duration.ofSeconds(15))
            .build();

        HttpResponse<String> resp = client.send(postReq, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() != 201) {
            String detail = extraireMessageErreurKeycloak(resp.body());
            throw new RuntimeException("Keycloak POST /users → HTTP " + resp.statusCode() + " : " + detail);
        }

        // L'ID de l'utilisateur créé est dans le header Location : .../users/{id}
        String location = resp.headers().firstValue("Location").orElseThrow(
            () -> new RuntimeException("Header Location absent dans la réponse Keycloak"));
        return location.substring(location.lastIndexOf('/') + 1);
    }

    private void assignerRole(String keycloakUserId, String roleName,
                               String adminToken, HttpClient client) throws Exception {
        // 1. Récupérer la représentation du rôle (id + name)
        HttpRequest getRole = HttpRequest.newBuilder()
            .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                + "/roles/" + URLEncoder.encode(roleName, StandardCharsets.UTF_8)))
            .header("Authorization", "Bearer " + adminToken)
            .GET().timeout(Duration.ofSeconds(10)).build();

        HttpResponse<String> roleResp = client.send(getRole, HttpResponse.BodyHandlers.ofString());
        if (roleResp.statusCode() != 200)
            throw new RuntimeException("Rôle Keycloak introuvable : " + roleName
                + " (HTTP " + roleResp.statusCode() + ")");

        Map<?, ?> roleRep = objectMapper.readValue(roleResp.body(), Map.class);

        // 2. Assigner le rôle realm à l'utilisateur
        HttpRequest postRoles = HttpRequest.newBuilder()
            .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                + "/users/" + keycloakUserId + "/role-mappings/realm"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + adminToken)
            .POST(HttpRequest.BodyPublishers.ofString(
                objectMapper.writeValueAsString(List.of(roleRep))))
            .timeout(Duration.ofSeconds(10)).build();

        HttpResponse<String> assignResp = client.send(postRoles, HttpResponse.BodyHandlers.ofString());
        if (assignResp.statusCode() >= 400)
            throw new RuntimeException("Assignation rôle échouée : HTTP " + assignResp.statusCode());
    }

    private void compenserKeycloak(String keycloakUserId, String adminToken, HttpClient client) {
        try {
            HttpRequest del = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/admin/realms/" + keycloakRealm
                    + "/users/" + keycloakUserId))
                .header("Authorization", "Bearer " + adminToken)
                .DELETE().timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> resp = client.send(del, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 300)
                log.info("[inscription] Compensation OK : compte Keycloak {} supprimé", keycloakUserId);
            else
                log.error("[inscription] Compensation ÉCHOUÉE : HTTP {} pour userId={}",
                          resp.statusCode(), keycloakUserId);
        } catch (Exception ex) {
            log.error("[inscription] Compensation EXCEPTION pour userId={} : {}", keycloakUserId, ex.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String genererMotDePasse() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++)
            sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        return sb.toString();
    }

    private String fetchAdminToken(HttpClient client) {
        try {
            String form = "grant_type=password&client_id=admin-cli"
                + "&username=" + URLEncoder.encode(keycloakAdminUsername, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(keycloakAdminPassword, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(keycloakUrl + "/realms/master/protocol/openid-connect/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200)
                throw new RuntimeException("Token admin refusé : HTTP " + resp.statusCode());
            Map<?, ?> body = objectMapper.readValue(resp.body(), Map.class);
            return (String) body.get("access_token");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Keycloak inaccessible : " + e.getMessage());
        }
    }

    private String extraireMessageErreurKeycloak(String body) {
        try {
            Map<String, Object> map = objectMapper.readValue(body, Map.class);
            Object msg = map.get("errorMessage");
            return msg != null ? msg.toString() : body;
        } catch (Exception e) {
            return body;
        }
    }
}
