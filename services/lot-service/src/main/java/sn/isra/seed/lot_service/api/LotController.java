package sn.isra.seed.lot_service.api;
import sn.isra.seed.lot_service.api.dto.CreateChildLotRequest;
import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotController {
  private final LotRepo lotRepo;
  private final GenerationRepo generationRepo;
  private final LotEventProducer producer;
  private final ObjectMapper om = new ObjectMapper();

  // ── Liste tous les lots avec filtre optionnel génération ──
  @GetMapping
  public List<LotSemencier> list(
      @RequestParam(required=false) String generation,
      @RequestParam(required=false) Long idVariete) {
    if (generation != null && !generation.isBlank())
      return lotRepo.findByGeneration_CodeGeneration(generation);
    if (idVariete != null)
      return lotRepo.findByIdVariete(idVariete);
    return lotRepo.findAll();
  }

  // ── Détail d'un lot ───────────────────────────────────────
  @GetMapping("/{id}")
  public ResponseEntity<LotSemencier> getById(@PathVariable Long id) {
    return lotRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // ── Créer un lot racine (G0) ──────────────────────────────
  @PostMapping
  public LotSemencier create(@RequestBody LotSemencier lot) throws Exception {
    LotSemencier saved = lotRepo.save(lot);
    producer.lotCreated(om.writeValueAsString(saved));
    return saved;
  }

  // ── Créer un lot enfant (G1 depuis G0, G2 depuis G1…) ────
  @PostMapping("/{id}/child")
  public LotSemencier createChild(@PathVariable Long id,
                                   @RequestBody CreateChildLotRequest req) throws Exception {
    LotSemencier parent = lotRepo.findById(id).orElseThrow();
    Generation gen = generationRepo.findByCodeGeneration(req.generationCode()).orElseThrow();
    LotSemencier child = new LotSemencier();
    child.setCodeLot(req.codeLot());
    child.setIdVariete(req.idVariete() != null ? req.idVariete() : parent.getIdVariete());
    child.setGeneration(gen);
    child.setLotParent(parent);
    child.setCampagne(req.campagne());
    child.setDateProduction(req.dateProduction());
    child.setQuantiteNette(req.quantiteNette());
    child.setUnite(req.unite() == null ? "kg" : req.unite());
    child.setTauxGermination(req.tauxGermination());
    child.setPuretePhysique(req.puretePhysique());
    child.setStatutLot("DISPONIBLE");
    LotSemencier saved = lotRepo.save(child);
    producer.lotCreated(om.writeValueAsString(saved));
    return saved;
  }

  // ── Changer le statut d'un lot ────────────────────────────
  @PatchMapping("/{id}/statut")
  public ResponseEntity<LotSemencier> updateStatut(@PathVariable Long id,
                                                     @RequestBody Map<String, String> body) {
    return lotRepo.findById(id).map(lot -> {
      lot.setStatutLot(body.get("statut"));
      return ResponseEntity.ok(lotRepo.save(lot));
    }).orElse(ResponseEntity.notFound().build());
  }

  // ── Transférer un lot vers un autre acteur ────────────────
  @PostMapping("/{id}/transfer")
  public ResponseEntity<LotSemencier> transfer(@PathVariable Long id,
                                                @RequestBody Map<String, String> body) throws Exception {
    return lotRepo.findById(id).map(lot -> {
      lot.setStatutLot("TRANSFERE");
      LotSemencier saved = lotRepo.save(lot);
      try { producer.lotCreated(om.writeValueAsString(saved)); } catch (Exception ignored) {}
      return ResponseEntity.ok(saved);
    }).orElse(ResponseEntity.notFound().build());
  }

  // ── Arbre généalogique G0→R2 ─────────────────────────────
  @GetMapping("/{id}/lineage")
  public ResponseEntity<List<LotSemencier>> lineage(@PathVariable Long id) {
    List<LotSemencier> chain = new ArrayList<>();
    lotRepo.findById(id).ifPresent(lot -> {
      // Remonte vers les parents
      LotSemencier current = lot;
      while (current != null) {
        chain.add(0, current);
        current = current.getLotParent();
      }
    });
    return chain.isEmpty()
        ? ResponseEntity.notFound().build()
        : ResponseEntity.ok(chain);
  }
}
