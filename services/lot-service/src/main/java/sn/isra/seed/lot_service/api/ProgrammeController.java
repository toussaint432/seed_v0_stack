package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.Programme;
import sn.isra.seed.lot_service.repo.ProgrammeRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class ProgrammeController {

    private final ProgrammeRepo programmeRepo;

    @GetMapping
    public List<Programme> list(
            @RequestParam(required = false) String statut,
            @AuthenticationPrincipal Jwt jwt) {

        String role = extractRole(jwt);
        List<Programme> all = (statut != null && !statut.isBlank())
                ? programmeRepo.findByStatut(statut.toUpperCase())
                : programmeRepo.findAll();

        // L'admin voit tout ; les autres ne voient que leurs propres programmes
        if ("seed-admin".equals(role)) return all;
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        if (username == null) return List.of();
        return all.stream()
                .filter(p -> username.equals(p.getUsernameCreateur()))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Programme> getById(@PathVariable Long id) {
        return programmeRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl')")
    @PostMapping
    public Programme create(@Valid @RequestBody Programme programme,
                            @AuthenticationPrincipal Jwt jwt) {
        if (jwt != null) {
            programme.setUsernameCreateur(jwt.getClaimAsString("preferred_username"));
            programme.setRoleCreateur(extractRole(jwt));
        }
        return programmeRepo.save(programme);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl')")
    @PutMapping("/{id}")
    public ResponseEntity<Programme> update(@PathVariable Long id,
                                            @Valid @RequestBody Programme body,
                                            @AuthenticationPrincipal Jwt jwt) {
        Programme p = programmeRepo.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        String role = extractRole(jwt);
        if (!"seed-admin".equals(role) && !p.getUsernameCreateur().equals(username)) {
            return ResponseEntity.status(403).build();
        }
        p.setCodeProgramme(body.getCodeProgramme());
        p.setIdLot(body.getIdLot());
        p.setIdOrganisation(body.getIdOrganisation());
        p.setGenerationCible(body.getGenerationCible());
        p.setMultiplicateur(body.getMultiplicateur());
        p.setCampagne(body.getCampagne());
        p.setSuperficieHa(body.getSuperficieHa());
        p.setObjectifKg(body.getObjectifKg());
        p.setDateDebut(body.getDateDebut());
        p.setDateFin(body.getDateFin());
        p.setStatut(body.getStatut());
        p.setObservations(body.getObservations());
        return ResponseEntity.ok(programmeRepo.save(p));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @AuthenticationPrincipal Jwt jwt) {
        Programme prog = programmeRepo.findById(id).orElse(null);
        if (prog == null) return ResponseEntity.notFound().build();
        String username = jwt != null ? jwt.getClaimAsString("preferred_username") : null;
        String role = extractRole(jwt);
        if (!"seed-admin".equals(role) && !prog.getUsernameCreateur().equals(username)) {
            return ResponseEntity.status(403).build();
        }
        programmeRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String extractRole(Jwt jwt) {
        if (jwt == null) return "";
        try {
            var realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null) return "";
            @SuppressWarnings("unchecked")
            var roles = (java.util.List<String>) realmAccess.get("roles");
            if (roles == null) return "";
            return roles.stream()
                    .filter(r -> r.startsWith("seed-"))
                    .findFirst().orElse("");
        } catch (Exception e) { return ""; }
    }
}
