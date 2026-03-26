package sn.isra.seed.order_service.api;

import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.repo.OrganisationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organisations")
@RequiredArgsConstructor
public class OrganisationController {

    private final OrganisationRepo organisationRepo;

    @GetMapping
    public List<Organisation> list(@RequestParam(required = false) String type) {
        if (type != null && !type.isBlank())
            return organisationRepo.findByTypeOrganisation(type.toUpperCase());
        return organisationRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Organisation> getById(@PathVariable Long id) {
        return organisationRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Organisation create(@RequestBody Organisation organisation) {
        return organisationRepo.save(organisation);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Organisation> update(@PathVariable Long id, @RequestBody Organisation body) {
        return organisationRepo.findById(id).map(o -> {
            o.setCodeOrganisation(body.getCodeOrganisation());
            o.setNomOrganisation(body.getNomOrganisation());
            o.setTypeOrganisation(body.getTypeOrganisation());
            o.setRegion(body.getRegion());
            o.setContact(body.getContact());
            return ResponseEntity.ok(organisationRepo.save(o));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!organisationRepo.existsById(id)) return ResponseEntity.notFound().build();
        organisationRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
