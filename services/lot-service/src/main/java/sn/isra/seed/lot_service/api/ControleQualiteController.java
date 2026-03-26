package sn.isra.seed.lot_service.api;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import sn.isra.seed.lot_service.entity.ControleQualite;
import sn.isra.seed.lot_service.repo.ControleQualiteRepo;
import java.util.List;

@RestController
@RequestMapping("/api/controls")
@RequiredArgsConstructor
public class ControleQualiteController {

    private final ControleQualiteRepo repo;

    @GetMapping
    public List<ControleQualite> list(@RequestParam(required = false) Long idLot) {
        if (idLot != null) return repo.findByIdLot(idLot);
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ControleQualite> getById(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ControleQualite create(@RequestBody ControleQualite ctrl) {
        return repo.save(ctrl);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ControleQualite> update(@PathVariable Long id,
                                                   @RequestBody ControleQualite body) {
        return repo.findById(id).map(existing -> {
            body.setId(id);
            body.setCreatedAt(existing.getCreatedAt());
            return ResponseEntity.ok(repo.save(body));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
