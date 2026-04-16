package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.entity.enums.TypeOrganisation;
import sn.isra.seed.order_service.repo.OrganisationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/organisations")
@RequiredArgsConstructor
public class OrganisationController {

    private final OrganisationRepo organisationRepo;

    @GetMapping
    public List<Organisation> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String region) {
        if (type != null && !type.isBlank()) {
            try {
                return organisationRepo.findByTypeOrganisation(TypeOrganisation.valueOf(type.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type inconnu : " + type);
            }
        }
        if (region != null && !region.isBlank())
            return organisationRepo.findByRegion(region);
        return organisationRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Organisation> getById(@PathVariable Long id) {
        return organisationRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<Organisation> getByCode(@PathVariable String code) {
        return organisationRepo.findByCodeOrganisation(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PostMapping
    public Organisation create(@RequestBody Organisation organisation) {
        return organisationRepo.save(organisation);
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PutMapping("/{id}")
    public ResponseEntity<Organisation> update(@PathVariable Long id, @RequestBody Organisation body) {
        return organisationRepo.findById(id).map(o -> {
            if (body.getCodeOrganisation() != null) o.setCodeOrganisation(body.getCodeOrganisation());
            if (body.getNomOrganisation() != null) o.setNomOrganisation(body.getNomOrganisation());
            if (body.getTypeOrganisation() != null) o.setTypeOrganisation(body.getTypeOrganisation());
            if (body.getRegion() != null) o.setRegion(body.getRegion());
            if (body.getLocalite() != null) o.setLocalite(body.getLocalite());
            if (body.getTelephone() != null) o.setTelephone(body.getTelephone());
            if (body.getEmail() != null) o.setEmail(body.getEmail());
            if (body.getLatitude() != null) o.setLatitude(body.getLatitude());
            if (body.getLongitude() != null) o.setLongitude(body.getLongitude());
            if (body.getActive() != null) o.setActive(body.getActive());
            return ResponseEntity.ok(organisationRepo.save(o));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Organisation o = organisationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // Soft delete : on désactive au lieu de supprimer
        o.setActive(false);
        organisationRepo.save(o);
        return ResponseEntity.noContent().build();
    }
}
