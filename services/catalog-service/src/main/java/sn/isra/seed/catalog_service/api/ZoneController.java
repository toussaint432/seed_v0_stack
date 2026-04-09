package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.VarieteZone;
import sn.isra.seed.catalog_service.entity.VarieteZoneId;
import sn.isra.seed.catalog_service.entity.ZoneAgro;
import sn.isra.seed.catalog_service.entity.enums.NiveauAdaptation;
import sn.isra.seed.catalog_service.repo.VarieteZoneRepo;
import sn.isra.seed.catalog_service.repo.ZoneAgroRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ZoneController {

    private final ZoneAgroRepo zoneRepo;
    private final VarieteZoneRepo varieteZoneRepo;

    /** GET /api/zones — public, sans authentification */
    @GetMapping("/zones")
    public List<ZoneAgro> getZones() {
        return zoneRepo.findAll();
    }

    /** GET /api/varieties/{id}/zones — public */
    @GetMapping("/varieties/{id}/zones")
    public List<VarieteZone> getVarieteZones(@PathVariable Long id) {
        return varieteZoneRepo.findByIdIdVariete(id);
    }

    /**
     * PUT /api/varieties/{id}/zones — réservé seed-selector et seed-admin.
     * Remplace toutes les zones d'une variété.
     */
    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @PutMapping("/varieties/{id}/zones")
    @Transactional
    public ResponseEntity<List<VarieteZone>> updateVarieteZones(
            @PathVariable Long id,
            @RequestBody List<ZoneAssignRequest> zones) {

        varieteZoneRepo.deleteByVarieteId(id);
        varieteZoneRepo.flush();

        for (ZoneAssignRequest z : zones) {
            NiveauAdaptation niveau;
            if (z.niveauAdaptation() != null && !z.niveauAdaptation().isBlank()) {
                try {
                    niveau = NiveauAdaptation.valueOf(z.niveauAdaptation().toUpperCase());
                } catch (IllegalArgumentException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Niveau d'adaptation invalide : " + z.niveauAdaptation() +
                        ". Valeurs acceptées : OPTIMAL, ACCEPTABLE, MARGINALE");
                }
            } else {
                niveau = NiveauAdaptation.OPTIMAL;
            }
            VarieteZone vz = new VarieteZone();
            vz.setId(new VarieteZoneId(id, z.idZone()));
            vz.setNiveauAdaptation(niveau);
            varieteZoneRepo.save(vz);
        }

        return ResponseEntity.ok(varieteZoneRepo.findByIdIdVariete(id));
    }

    /** DTO reçu pour assigner une zone à une variété */
    record ZoneAssignRequest(Long idZone, String niveauAdaptation) {}
}
