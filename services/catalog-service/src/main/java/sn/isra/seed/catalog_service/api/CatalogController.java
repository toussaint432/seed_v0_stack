package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

  private final EspeceRepo especeRepo;
  private final VarieteRepo varieteRepo;

  // ── Espèces ──────────────────────────────────────────────
  @GetMapping("/species")
  public List<Espece> species() {
    return especeRepo.findAll();
  }

  @PostMapping("/species")
  public Espece createSpecies(@RequestBody Espece e) {
    return especeRepo.save(e);
  }

  @GetMapping("/species/{id}")
  public ResponseEntity<Espece> getSpecies(@PathVariable Long id) {
    return especeRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // ── Variétés ─────────────────────────────────────────────
  @GetMapping("/varieties")
  public List<Variete> varieties(
      @RequestParam(required=false) Long especeId,
      @RequestParam(required=false) String statut) {
    if (especeId != null) return varieteRepo.findByEspece_Id(especeId);
    if (statut != null) return varieteRepo.findByStatutVariete(statut);
    return varieteRepo.findAll();
  }

  @GetMapping("/varieties/{id}")
  public ResponseEntity<Variete> getVariete(@PathVariable Long id) {
    return varieteRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping("/varieties")
  public Variete createVariety(@RequestBody Variete v) {
    return varieteRepo.save(v);
  }

  @PatchMapping("/varieties/{id}/statut")
  public ResponseEntity<Variete> updateStatut(@PathVariable Long id,
                                               @RequestBody java.util.Map<String, String> body) {
    return varieteRepo.findById(id).map(v -> {
      v.setStatutVariete(body.get("statut"));
      return ResponseEntity.ok(varieteRepo.save(v));
    }).orElse(ResponseEntity.notFound().build());
  }
}
