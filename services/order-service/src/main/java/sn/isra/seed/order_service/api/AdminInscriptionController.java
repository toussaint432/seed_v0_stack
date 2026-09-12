package sn.isra.seed.order_service.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import sn.isra.seed.order_service.api.dto.AdminInscriptionRequest;
import sn.isra.seed.order_service.api.dto.AdminInscriptionResult;
import sn.isra.seed.order_service.service.AdminInscriptionService;

/**
 * POST /api/admin/inscription — création atomique d'un acteur de la chaîne semencière.
 *
 * Accès exclusif : seed-admin.
 * Le workflow est orchestré par AdminInscriptionService (pattern SAGA avec compensation).
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminInscriptionController {

    private final AdminInscriptionService inscriptionService;

    /**
     * Crée un compte Keycloak + organisation + site (Cas A) ou un compte seul (Cas B)
     * en une seule requête atomique avec compensation en cas d'échec.
     *
     * Cas A (idOrganisationExistante = null) :
     *   Organisation → Site principal → Compte Keycloak → membre_organisation (principal=true)
     *
     * Cas B (idOrganisationExistante non-null) :
     *   Compte Keycloak → membre_organisation (principal=false)
     *   Exemple : second agent UPSemCL rattaché à l'org id=2 existante.
     */
    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PostMapping("/inscription")
    public ResponseEntity<AdminInscriptionResult> inscrire(
            @Valid @RequestBody AdminInscriptionRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String adminUsername = jwt != null ? jwt.getClaimAsString("preferred_username") : "system";
        String cas = req.idOrganisationExistante() == null ? "A (nouvelle org)" : "B (org id=" + req.idOrganisationExistante() + ")";
        log.info("[inscription] Démarrage par '{}' — username cible='{}' rôle='{}' cas={}",
                 adminUsername, req.username(), req.role(), cas);

        AdminInscriptionResult result = inscriptionService.inscrire(req);
        return ResponseEntity.status(201).body(result);
    }
}
