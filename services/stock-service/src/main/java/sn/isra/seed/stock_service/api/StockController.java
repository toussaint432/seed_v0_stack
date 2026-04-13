package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.api.dto.MovementRequest;
import sn.isra.seed.stock_service.api.dto.UpsertStockRequest;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.Stock;
import sn.isra.seed.stock_service.entity.enums.TypeMouvement;
import sn.isra.seed.stock_service.kafka.StockEventProducer;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StockController {

  private final StockRepo stockRepo;
  private final SiteRepo siteRepo;
  private final MouvementRepo mouvementRepo;
  private final StockEventProducer producer;
  private final ObjectMapper om;

  @GetMapping("/stocks")
  public List<Stock> list(@RequestParam(required = false) String site,
                          @AuthenticationPrincipal Jwt jwt) {
    // Isolation multiplicateur : ne retourner que son stock
    if (jwt != null && isMultiplicateur(jwt)) {
      Object orgClaim = jwt.getClaim("org_id");
      if (orgClaim != null) {
        try { return stockRepo.findByOrganisation(Long.parseLong(orgClaim.toString())); }
        catch (NumberFormatException ignored) {}
      }
      return List.of();
    }
    if (site == null || site.isBlank()) return stockRepo.findAll();
    return stockRepo.findBySite_CodeSite(site);
  }

  private boolean isMultiplicateur(Jwt jwt) {
    try {
      java.util.Map<String, Object> realmAccess = jwt.getClaim("realm_access");
      if (realmAccess == null) return false;
      Object roles = realmAccess.get("roles");
      if (roles instanceof java.util.List<?> list) return list.contains("seed-multiplicator");
    } catch (Exception ignored) {}
    return false;
  }

  /**
   * GET /api/stocks/mon-stock — stocks propres au multiplicateur connecté.
   * Isolation par organisation : chaque multiplicateur ne voit que les stocks
   * des sites rattachés à son organisation (site.id_organisation = org_id du JWT).
   */
  @GetMapping("/stocks/mon-stock")
  public ResponseEntity<List<Stock>> monStock(@AuthenticationPrincipal Jwt jwt) {
    if (jwt == null) return ResponseEntity.status(401).build();
    Object orgClaim = jwt.getClaim("org_id");
    if (orgClaim == null) return ResponseEntity.ok(List.of());
    Long orgId;
    try { orgId = Long.parseLong(orgClaim.toString()); }
    catch (NumberFormatException e) { return ResponseEntity.badRequest().build(); }
    return ResponseEntity.ok(stockRepo.findByOrganisation(orgId));
  }

  @PostMapping("/stocks")
  public Stock upsert(@RequestBody UpsertStockRequest req) throws Exception {
    Site site = siteRepo.findByCodeSite(req.siteCode()).orElseThrow();
    Stock stock = stockRepo.findByIdLotAndSite_CodeSite(req.idLot(), req.siteCode())
        .orElseGet(() -> {
          Stock s = new Stock();
          s.setIdLot(req.idLot());
          s.setSite(site);
          s.setQuantiteDisponible(BigDecimal.ZERO);
          s.setUnite(req.unite() == null ? "kg" : req.unite());
          return s;
        });

    stock.setQuantiteDisponible(req.quantite());
    stock.setUnite(req.unite() == null ? stock.getUnite() : req.unite());
    stock.setUpdatedAt(Instant.now());
    Stock saved = stockRepo.save(stock);
    producer.stockUpdated(om.writeValueAsString(saved));
    return saved;
  }

  @Transactional
  @PostMapping("/movements")
  public MouvementStock move(@RequestBody MovementRequest req) throws Exception {
    BigDecimal q = req.quantite();
    if (q == null || q.signum() <= 0)
      throw new IllegalArgumentException("quantite doit être > 0");

    // Parser le type (String → enum)
    TypeMouvement type;
    try {
      type = TypeMouvement.valueOf(req.type().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Type de mouvement invalide : " + req.type() + ". Valeurs acceptées : IN, OUT, TRANSFER");
    }

    Site src = req.siteSourceCode() == null      ? null : siteRepo.findByCodeSite(req.siteSourceCode()).orElseThrow();
    Site dst = req.siteDestinationCode() == null ? null : siteRepo.findByCodeSite(req.siteDestinationCode()).orElseThrow();

    switch (type) {
      case IN -> {
        if (dst == null) throw new IllegalArgumentException("destination requise pour IN");
        upsertInternal(req.idLot(), dst.getCodeSite(), q, req.unite());
      }
      case OUT -> {
        if (src == null) throw new IllegalArgumentException("source requise pour OUT");
        upsertInternal(req.idLot(), src.getCodeSite(), q.negate(), req.unite());
      }
      case TRANSFER -> {
        if (src == null || dst == null)
          throw new IllegalArgumentException("source et destination requises pour TRANSFER");
        upsertInternal(req.idLot(), src.getCodeSite(), q.negate(), req.unite());
        upsertInternal(req.idLot(), dst.getCodeSite(), q, req.unite());
      }
    }

    MouvementStock m = new MouvementStock();
    m.setIdLot(req.idLot());
    m.setTypeMouvement(type);
    m.setSiteSource(src);
    m.setSiteDestination(dst);
    m.setQuantite(q);
    m.setUnite(req.unite() == null ? "kg" : req.unite());
    m.setReferenceOperation(req.reference());
    m.setCreatedAt(Instant.now());
    MouvementStock saved = mouvementRepo.save(m);

    producer.stockMoved(om.writeValueAsString(saved));
    return saved;
  }

  private void upsertInternal(Long idLot, String siteCode, BigDecimal delta, String unite) {
    Site site = siteRepo.findByCodeSite(siteCode).orElseThrow();
    Stock stock = stockRepo.findByIdLotAndSite_CodeSite(idLot, siteCode)
        .orElseGet(() -> {
          Stock s = new Stock();
          s.setIdLot(idLot);
          s.setSite(site);
          s.setQuantiteDisponible(BigDecimal.ZERO);
          s.setUnite(unite == null ? "kg" : unite);
          return s;
        });
    BigDecimal newQ = stock.getQuantiteDisponible().add(delta);
    if (newQ.signum() < 0)
      throw new IllegalStateException("Stock insuffisant au site : " + siteCode);
    stock.setQuantiteDisponible(newQ);
    stock.setUpdatedAt(Instant.now());
    stockRepo.save(stock);
  }
}
