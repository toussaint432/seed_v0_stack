package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.entity.MembreOrganisation;
import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.OrganisationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/membres")
@RequiredArgsConstructor
public class MembreController {

    private final MembreOrganisationRepo membreRepo;
    private final OrganisationRepo organisationRepo;

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

    /** DTO pour création/mise à jour */
    public record CreateMembreRequest(
            String keycloakUsername,
            String keycloakRole,
            String nomComplet,
            Long idOrganisation,
            String roleDansOrg,
            Boolean principal,
            String telephone
    ) {}
}
