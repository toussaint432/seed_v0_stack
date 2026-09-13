package sn.isra.seed.stock_service.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.stock_service.api.dto.MovementRequest;
import sn.isra.seed.stock_service.api.dto.StockAgregeDto;
import sn.isra.seed.stock_service.api.dto.StockDto;
import sn.isra.seed.stock_service.api.dto.UpsertStockRequest;
import sn.isra.seed.stock_service.api.mapper.StockMapper;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.StockRepo;
import sn.isra.seed.stock_service.service.StockService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StockController {

  private final StockRepo    stockRepo;
  private final MouvementRepo mouvementRepo;
  private final StockService  stockService;
  private final StockMapper   stockMapper;

  @GetMapping("/stocks")
  public Page<StockDto> list(
      @RequestParam(required = false) String site,
      @AuthenticationPrincipal Jwt jwt,
      @PageableDefault(size = 20) Pageable pageable) {
    return stockService.list(site, jwt, pageable).map(stockMapper::toDto);
  }

  private static final BigDecimal SEUIL_ALERTE_STOCK = new BigDecimal("50");

  @GetMapping("/stocks/alerts/count")
  public Map<String, Long> alertsCount(@AuthenticationPrincipal Jwt jwt) {
    if (jwt == null) return Map.of("count", 0L);
    Long orgId = stockService.resolveOrgId(jwt);
    long count = (orgId != null)
        ? stockRepo.countLowStockByOrg(orgId, SEUIL_ALERTE_STOCK)
        : stockRepo.countLowStock(SEUIL_ALERTE_STOCK);
    return Map.of("count", count);
  }

  @GetMapping("/stocks/agrege")
  public ResponseEntity<List<StockAgregeDto>> agrege(@AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok(stockService.agrege(jwt));
  }

  @GetMapping("/stocks/mon-stock")
  public ResponseEntity<List<StockDto>> monStock(@AuthenticationPrincipal Jwt jwt) {
    if (jwt == null) return ResponseEntity.status(401).build();
    Long orgId = stockService.resolveOrgId(jwt);
    if (orgId == null) return ResponseEntity.ok(List.of());
    return ResponseEntity.ok(stockMapper.toDtoList(stockRepo.findByOrganisation(orgId)));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
  @PostMapping("/stocks")
  public StockDto upsert(@Valid @RequestBody UpsertStockRequest req) throws Exception {
    return stockMapper.toDto(stockService.upsert(req));
  }

  @GetMapping("/movements")
  public List<MouvementStock> listMovements(@RequestParam(required = false) Long idLot) {
    if (idLot != null) return mouvementRepo.findByIdLotOrderByCreatedAtDesc(idLot);
    return mouvementRepo.findAllByOrderByCreatedAtDesc();
  }

  @PreAuthorize("hasAuthority('ROLE_seed-admin')")
  @PutMapping("/stocks/{id}")
  public ResponseEntity<StockDto> updateStock(@PathVariable Long id,
                                               @Valid @RequestBody UpsertStockRequest req) throws Exception {
    var stock = stockRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stock non trouvé"));
    if (req.quantite() != null) stock.setQuantiteDisponible(req.quantite());
    if (req.unite()    != null) stock.setUnite(req.unite());
    stock.setUpdatedAt(java.time.Instant.now());
    return ResponseEntity.ok(stockMapper.toDto(stockRepo.save(stock)));
  }

  @PreAuthorize("hasAuthority('ROLE_seed-admin')")
  @Transactional
  @DeleteMapping("/stocks/{id}")
  public ResponseEntity<Void> deleteStock(@PathVariable Long id) {
    if (!stockRepo.existsById(id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stock non trouvé");
    stockRepo.deleteById(id);
    return ResponseEntity.noContent().build();
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
  @PostMapping("/movements")
  public MouvementStock move(@Valid @RequestBody MovementRequest req) throws Exception {
    return stockService.move(req);
  }
}
