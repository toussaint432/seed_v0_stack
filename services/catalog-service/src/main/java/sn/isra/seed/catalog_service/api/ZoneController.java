package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Departement;
import sn.isra.seed.catalog_service.entity.Region;
import sn.isra.seed.catalog_service.entity.VarieteZone;
import sn.isra.seed.catalog_service.entity.VarieteZoneId;
import sn.isra.seed.catalog_service.entity.ZoneAgro;
import sn.isra.seed.catalog_service.entity.ZoneEspece;
import sn.isra.seed.catalog_service.entity.enums.NiveauAdaptation;
import sn.isra.seed.catalog_service.repo.DepartementRepo;
import sn.isra.seed.catalog_service.repo.RegionRepo;
import sn.isra.seed.catalog_service.repo.VarieteZoneRepo;
import sn.isra.seed.catalog_service.repo.ZoneAgroRepo;
import sn.isra.seed.catalog_service.repo.ZoneEspeceRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ZoneController {

    private final ZoneAgroRepo     zoneRepo;
    private final VarieteZoneRepo  varieteZoneRepo;
    private final RegionRepo       regionRepo;
    private final DepartementRepo  departementRepo;
    private final ZoneEspeceRepo   zoneEspeceRepo;

    /* ── GET /api/zones — liste triée alphabétiquement, public ── */
    @GetMapping("/zones")
    public List<ZoneAgro> getZones() {
        return zoneRepo.findAllByOrderByNomAsc();
    }

    /* ── GET /api/zones/ma-zone — ZAE de l'utilisateur connecté ── */
    /**
     * Résout la Zone Agro-Écologique principale de l'utilisateur via :
     * JWT.preferred_username → membre_organisation → organisation.id_zone_agro → zone_agro
     *
     * Retourne 204 No Content si l'utilisateur n'a pas encore de zone configurée
     * (il verra alors "Toutes zones" sélectionné par défaut dans le catalogue).
     */
    @GetMapping("/zones/ma-zone")
    public ResponseEntity<ZoneAgro> getMaZone(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        List<Object[]> rows = zoneRepo.findRawZoneByUsername(username);
        if (rows.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(mapRowToZone(rows.get(0)));
    }

    /* ── GET /api/zones/par-departement/{deptId} — zone d'un département ── */
    @GetMapping("/zones/par-departement/{deptId}")
    public ResponseEntity<ZoneAgro> getZoneByDepartement(@PathVariable Integer deptId) {
        List<Object[]> rows = zoneRepo.findRawZoneByDepartementId(deptId);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(mapRowToZone(rows.get(0)));
    }

    /* ── GET /api/regions — 14 régions du Sénégal, triées A→Z ── */
    @GetMapping("/regions")
    public List<Region> getRegions() {
        return regionRepo.findAllByOrderByNomAsc();
    }

    /* ── GET /api/departements — filtrable par regionId ou zoneId ── */
    @GetMapping("/departements")
    public List<Departement> getDepartements(
            @RequestParam(required = false) Integer regionId,
            @RequestParam(required = false) Integer zoneId) {
        if (zoneId != null)
            return departementRepo.findByZoneAgroIdOrderByNomAsc(zoneId);
        if (regionId != null)
            return departementRepo.findByRegionIdOrderByNomAsc(regionId);
        return departementRepo.findAllByOrderByNomAsc();
    }

    /* ── GET /api/zones/{id}/especes — espèces recommandées pour une ZAE ── */
    @GetMapping("/zones/{id}/especes")
    public List<ZoneEspece> getEspecesByZone(@PathVariable Long id) {
        return zoneEspeceRepo.findByIdIdZoneAgro(id);
    }

    /* ── GET /api/varieties/{id}/zones — public ── */
    @Transactional(readOnly = true)
    @GetMapping("/varieties/{id}/zones")
    public List<VarieteZone> getVarieteZones(@PathVariable Long id) {
        return varieteZoneRepo.findByIdIdVariete(id);
    }

    /**
     * PUT /api/varieties/{id}/zones — seed-selector et seed-admin.
     * Remplace intégralement les zones d'une variété.
     * Reçoit une liste de { idZone, niveauAdaptation }.
     */
    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @PutMapping("/varieties/{id}/zones")
    @Transactional
    public ResponseEntity<List<VarieteZone>> updateVarieteZones(
            @PathVariable Long id,
            @Valid @RequestBody List<ZoneAssignRequest> zones) {

        varieteZoneRepo.deleteByVarieteId(id);
        varieteZoneRepo.flush();

        for (ZoneAssignRequest z : zones) {
            NiveauAdaptation niveau;
            if (z.niveauAdaptation() != null && !z.niveauAdaptation().isBlank()) {
                try {
                    niveau = NiveauAdaptation.valueOf(z.niveauAdaptation().toUpperCase());
                } catch (IllegalArgumentException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Niveau invalide : " + z.niveauAdaptation()
                        + ". Valeurs : OPTIMAL, ACCEPTABLE, MARGINALE");
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

    /* ── DTO ── */
    record ZoneAssignRequest(Long idZone, String niveauAdaptation) {}

    /** Mappe une projection native Object[] vers ZoneAgro (id, code, nom, description). */
    private ZoneAgro mapRowToZone(Object[] row) {
        ZoneAgro z = new ZoneAgro();
        z.setId(((Number) row[0]).longValue());
        z.setCode((String) row[1]);
        z.setNom((String) row[2]);
        z.setDescription(row[3] != null ? (String) row[3] : null);
        return z;
    }
}
