package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.Campagne;
import sn.isra.seed.lot_service.repo.CampagneRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/campagnes")
@RequiredArgsConstructor
public class CampagneController {

    private final CampagneRepo campagneRepo;

    @GetMapping
    public List<Campagne> list(@RequestParam(required = false) String statut) {
        if (statut != null && !statut.isBlank())
            return campagneRepo.findByStatut(statut.toUpperCase());
        return campagneRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Campagne> getById(@PathVariable Long id) {
        return campagneRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PostMapping
    public Campagne create(@Valid @RequestBody Campagne campagne) {
        return campagneRepo.save(campagne);
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PutMapping("/{id}")
    public ResponseEntity<Campagne> update(@PathVariable Long id, @Valid @RequestBody Campagne body) {
        return campagneRepo.findById(id).map(c -> {
            c.setCodeCampagne(body.getCodeCampagne());
            c.setLibelle(body.getLibelle());
            c.setAnnee(body.getAnnee());
            c.setDateDebut(body.getDateDebut());
            c.setDateFin(body.getDateFin());
            c.setStatut(body.getStatut());
            return ResponseEntity.ok(campagneRepo.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!campagneRepo.existsById(id)) return ResponseEntity.notFound().build();
        campagneRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
