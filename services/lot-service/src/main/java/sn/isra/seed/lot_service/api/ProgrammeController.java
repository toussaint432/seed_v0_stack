package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.Programme;
import sn.isra.seed.lot_service.repo.ProgrammeRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class ProgrammeController {

    private final ProgrammeRepo programmeRepo;

    @GetMapping
    public List<Programme> list(@RequestParam(required = false) String statut) {
        if (statut != null && !statut.isBlank())
            return programmeRepo.findByStatut(statut.toUpperCase());
        return programmeRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Programme> getById(@PathVariable Long id) {
        return programmeRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Programme create(@RequestBody Programme programme) {
        return programmeRepo.save(programme);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Programme> update(@PathVariable Long id, @RequestBody Programme body) {
        return programmeRepo.findById(id).map(p -> {
            p.setCodeProgramme(body.getCodeProgramme());
            p.setIdLot(body.getIdLot());
            p.setIdOrganisation(body.getIdOrganisation());
            p.setGenerationCible(body.getGenerationCible());
            p.setSuperficieHa(body.getSuperficieHa());
            p.setObjectifKg(body.getObjectifKg());
            p.setDateDebut(body.getDateDebut());
            p.setDateFin(body.getDateFin());
            p.setStatut(body.getStatut());
            p.setObservations(body.getObservations());
            return ResponseEntity.ok(programmeRepo.save(p));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!programmeRepo.existsById(id)) return ResponseEntity.notFound().build();
        programmeRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
