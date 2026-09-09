package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.Programme;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutProgramme;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.MembreOrgLotRepo;
import sn.isra.seed.lot_service.repo.ProgrammeRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class ProgrammeController {

    private final ProgrammeRepo        programmeRepo;
    private final LotRepo              lotRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final MembreOrgLotRepo     membreOrgRepo;

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

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @PostMapping
    public ResponseEntity<Programme> create(@Valid @RequestBody Programme programme,
                                            @AuthenticationPrincipal Jwt jwt) {
        if (jwt != null) {
            String username = jwt.getClaimAsString("preferred_username");
            programme.setUsernameCreateur(username);
            programme.setRoleCreateur(extractRole(jwt));
            if (programme.getIdOrganisation() == null)
                membreOrgRepo.findOrgIdByUsername(username).ifPresent(programme::setIdOrganisation);
        }
        programme.setStatut(StatutProgramme.PLANIFIE);
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(programmeRepo.save(programme));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Un programme avec le code '" + programme.getCodeProgramme()
                + "' existe déjà dans votre organisation.");
        }
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
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

        StatutProgramme ancienStatut = p.getStatut();
        StatutProgramme nouveauStatut = body.getStatut();

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
        p.setStatut(nouveauStatut);
        p.setObservations(body.getObservations());
        Programme saved = programmeRepo.save(p);

        // Cascade du statut programme → statut du lot source
        if (ancienStatut != nouveauStatut && saved.getIdLot() != null) {
            cascadeLotStatut(saved, ancienStatut, nouveauStatut, username);
        }

        return ResponseEntity.ok(saved);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
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

    /**
     * Cascade programme statut → lot source statut :
     * PLANIFIE → EN_COURS     : lot source passe EN_PRODUCTION (semis démarré)
     * EN_COURS → TERMINE      : lot source passe EPUISE ou DISPONIBLE selon quantité restante
     * EN_COURS → ANNULE/SUSPENDU : lot source revient DISPONIBLE (semences récupérées)
     */
    private void cascadeLotStatut(Programme prog, StatutProgramme ancien,
                                  StatutProgramme nouveau, String username) {
        lotRepo.findById(prog.getIdLot()).ifPresent(lot -> {
            StatutLot ancienLot = lot.getStatutLot();
            StatutLot nouveauLot = null;

            if (nouveau == StatutProgramme.EN_COURS && ancien == StatutProgramme.PLANIFIE
                    && ancienLot == StatutLot.DISPONIBLE) {
                nouveauLot = StatutLot.EN_PRODUCTION;
            } else if (nouveau == StatutProgramme.TERMINE && ancien == StatutProgramme.EN_COURS) {
                boolean epuise = lot.getQuantiteNette() == null
                        || lot.getQuantiteNette().compareTo(BigDecimal.ZERO) <= 0;
                nouveauLot = epuise ? StatutLot.EPUISE : StatutLot.DISPONIBLE;
            } else if ((nouveau == StatutProgramme.ANNULE || nouveau == StatutProgramme.SUSPENDU)
                    && ancien == StatutProgramme.EN_COURS
                    && ancienLot == StatutLot.EN_PRODUCTION) {
                nouveauLot = StatutLot.DISPONIBLE;
            }

            if (nouveauLot != null && nouveauLot != ancienLot) {
                lot.setStatutLot(nouveauLot);
                lotRepo.save(lot);
                historiqueRepo.save(HistoriqueStatutLot.of(
                        lot.getId(), ancienLot, nouveauLot, username,
                        "cascade programme " + prog.getCodeProgramme()));
            }
        });
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
