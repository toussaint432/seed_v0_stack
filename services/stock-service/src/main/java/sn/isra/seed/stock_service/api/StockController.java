package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.api.dto.MovementRequest;
import sn.isra.seed.stock_service.api.dto.UpsertStockRequest;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.Stock;
import sn.isra.seed.stock_service.kafka.StockEventProducer;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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
  private final ObjectMapper om = new ObjectMapper();

  @GetMapping("/stocks")
  public List<Stock> list(@RequestParam(name="site", required=false) String site) {
    if (site == null || site.isBlank()) return stockRepo.findAll();
    return stockRepo.findBySite_CodeSite(site);
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

  @PostMapping("/movements")
  public MouvementStock move(@RequestBody MovementRequest req) throws Exception {
    BigDecimal q = req.quantite();
    if (q == null || q.signum() <= 0) throw new IllegalArgumentException("quantite must be > 0");

    Site src = req.siteSourceCode() == null ? null : siteRepo.findByCodeSite(req.siteSourceCode()).orElseThrow();
    Site dst = req.siteDestinationCode() == null ? null : siteRepo.findByCodeSite(req.siteDestinationCode()).orElseThrow();

    // Update stocks
    if ("IN".equalsIgnoreCase(req.type())) {
      if (dst == null) throw new IllegalArgumentException("destination required for IN");
      upsertInternal(req.idLot(), dst.getCodeSite(), delta(q), req.unite());
    } else if ("OUT".equalsIgnoreCase(req.type())) {
      if (src == null) throw new IllegalArgumentException("source required for OUT");
      upsertInternal(req.idLot(), src.getCodeSite(), delta(q.negate()), req.unite());
    } else if ("TRANSFER".equalsIgnoreCase(req.type())) {
      if (src == null || dst == null) throw new IllegalArgumentException("source and destination required for TRANSFER");
      upsertInternal(req.idLot(), src.getCodeSite(), delta(q.negate()), req.unite());
      upsertInternal(req.idLot(), dst.getCodeSite(), delta(q), req.unite());
    } else {
      throw new IllegalArgumentException("unknown type");
    }

    MouvementStock m = new MouvementStock();
    m.setIdLot(req.idLot());
    m.setTypeMouvement(req.type().toUpperCase());
    m.setSiteSource(src);
    m.setSiteDestination(dst);
    m.setQuantite(q);
    m.setUnite(req.unite() == null ? "kg" : req.unite());
    m.setReferenceOperation(req.reference());
    m.setCreatedAt(Instant.now());
    MouvementStock saved = mouvementRepo.save(m);

    String payload = om.writeValueAsString(saved);
    producer.stockMoved(payload);
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
    if (newQ.signum() < 0) throw new IllegalStateException("Insufficient stock at " + siteCode);
    stock.setQuantiteDisponible(newQ);
    stock.setUpdatedAt(Instant.now());
    stockRepo.save(stock);
  }

  private BigDecimal delta(BigDecimal v) { return v; }
}
