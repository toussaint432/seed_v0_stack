package sn.isra.seed.stock_service.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.common.util.JwtHelper;
import sn.isra.seed.stock_service.api.dto.MovementRequest;
import sn.isra.seed.stock_service.api.dto.StockAgregeDto;
import sn.isra.seed.stock_service.api.dto.StockAgregeView;
import sn.isra.seed.stock_service.api.dto.UpsertStockRequest;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.Stock;
import sn.isra.seed.stock_service.entity.enums.TypeMouvement;
import sn.isra.seed.stock_service.kafka.StockEventProducer;
import sn.isra.seed.stock_service.repo.MembreOrgStockRepo;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockService {

    private final StockRepo           stockRepo;
    private final SiteRepo            siteRepo;
    private final MouvementRepo       mouvementRepo;
    private final StockEventProducer  producer;
    private final ObjectMapper        om;
    private final MembreOrgStockRepo  membreOrgRepo;

    // ── Liste avec isolation par rôle ────────────────────────────────────────

    public Page<Stock> list(String site, Jwt jwt, Pageable pageable) {
        if (jwt != null && JwtHelper.hasRole(jwt, "seed-multiplicator")) {
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return Page.empty(pageable);
            return stockRepo.findByOrganisation(orgId, pageable);
        }
        if (jwt != null && JwtHelper.hasRole(jwt, "seed-upsemcl")) {
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return Page.empty(pageable);
            return stockRepo.findByOrganisation(orgId, pageable);
        }
        if (site == null || site.isBlank()) return stockRepo.findAll(pageable);
        return stockRepo.findBySite_CodeSite(site, pageable);
    }

    // ── Agrégat par génération avec filtre rôle ──────────────────────────────

    public List<StockAgregeDto> agrege(Jwt jwt) {
        List<StockAgregeView> views;

        if (jwt != null && JwtHelper.hasRole(jwt, "seed-multiplicator")) {
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return List.of();
            views = stockRepo.findAgregeByOrganisation(orgId);
        } else if (jwt != null && JwtHelper.hasRole(jwt, "seed-upsemcl")) {
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return List.of();
            views = stockRepo.findAgregeByOrganisation(orgId);
        } else if (jwt != null && JwtHelper.hasRole(jwt, "seed-selector")) {
            String username = JwtHelper.getUsername(jwt);
            if (username == null) return List.of();
            views = stockRepo.findAgregeByUsernameCreateur(username);
        } else {
            views = stockRepo.findAllAgrege();
        }

        List<String> allowedGens = null;
        if (jwt != null) {
            if (JwtHelper.hasRole(jwt, "seed-upsemcl"))         allowedGens = List.of("G1", "G2", "G3");
            else if (JwtHelper.hasRole(jwt, "seed-selector"))   allowedGens = List.of("G0", "G1");
            else if (JwtHelper.hasRole(jwt, "seed-quotataire")) allowedGens = List.of("R2");
        }

        final List<String> finalGens = allowedGens;
        return views.stream()
            .filter(v -> finalGens == null || finalGens.contains(v.getCodeGeneration()))
            .map(this::toAgregeDto)
            .collect(Collectors.toList());
    }

    // ── Upsert stock ─────────────────────────────────────────────────────────

    public Stock upsert(UpsertStockRequest req) throws Exception {
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

    // ── Mouvement de stock ───────────────────────────────────────────────────

    @Transactional
    public MouvementStock move(MovementRequest req) throws Exception {
        BigDecimal q = req.quantite();
        if (q == null || q.signum() <= 0)
            throw new IllegalArgumentException("quantite doit être > 0");

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

    // ── Helpers ──────────────────────────────────────────────────────────────

    public Long resolveOrgId(Jwt jwt) {
        Long fromClaim = JwtHelper.resolveOrgIdFromClaim(jwt);
        if (fromClaim != null) return fromClaim;
        String username = JwtHelper.getUsername(jwt);
        return membreOrgRepo.findOrgIdByUsername(username).orElse(null);
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
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Stock insuffisant au site " + siteCode
                + " — disponible : " + stock.getQuantiteDisponible() + " " + stock.getUnite());
        stock.setQuantiteDisponible(newQ);
        stock.setUpdatedAt(Instant.now());
        stockRepo.save(stock);
    }

    private StockAgregeDto toAgregeDto(StockAgregeView v) {
        List<StockAgregeDto.LotDetailDto> details = List.of();
        String json = v.getLotsDetail();
        if (json != null && !json.isBlank() && !"null".equals(json)) {
            try {
                details = om.readValue(json, new TypeReference<List<StockAgregeDto.LotDetailDto>>() {});
            } catch (Exception ignored) {}
        }
        return new StockAgregeDto(
            v.getIdVariete(), v.getIdGeneration(), v.getIdSite(),
            v.getCodeSite(), v.getNomSite(), v.getCodeGeneration(),
            v.getNomVariete(), v.getCodeVariete(), v.getNomEspece(), v.getCodeEspece(),
            v.getUnite(), v.getQuantiteTotale(), v.getNbLots(), v.getDerniereMaj(), v.getCreatedAt(), details
        );
    }
}
