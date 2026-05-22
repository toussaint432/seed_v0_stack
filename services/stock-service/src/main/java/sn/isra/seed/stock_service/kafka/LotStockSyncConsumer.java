package sn.isra.seed.stock_service.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.enums.TypeMouvement;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Synchronise automatiquement le stock lors de la création d'un lot.
 *
 * Flux : lot-service publie "lot.stock.sync" → ce consumer crédite le stock
 * via un UPSERT PostgreSQL atomique (INSERT … ON CONFLICT DO UPDATE).
 *
 * Idempotent : si le message est rejoué (Kafka at-least-once), l'UPSERT
 * incrémentera à nouveau — acceptable car la création d'un lot est une
 * opération non-répétable (contrainte UNIQUE code_lot côté lot-service).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotStockSyncConsumer {

    private final StockRepo    stockRepo;
    private final SiteRepo     siteRepo;
    private final MouvementRepo mouvementRepo;
    private final ObjectMapper om;

    @SuppressWarnings("unchecked")
    @Transactional
    @KafkaListener(topics = "lot.stock.sync", groupId = "stock-service-lot-sync")
    public void onLotStockSync(String message) {
        try {
            Map<String, Object> payload = om.readValue(message, Map.class);

            Long       idLot    = ((Number) payload.get("idLot")).longValue();
            String     codeSite = (String) payload.get("codeSite");
            BigDecimal quantite = new BigDecimal(payload.get("quantite").toString());
            String     unite    = (String) payload.getOrDefault("unite", "kg");

            if (codeSite == null || codeSite.isBlank() || quantite.compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("LotStockSyncConsumer : payload invalide (idLot={}, codeSite={}, quantite={})",
                         idLot, codeSite, quantite);
                return;
            }

            Site site = siteRepo.findByCodeSite(codeSite).orElse(null);
            if (site == null) {
                log.warn("LotStockSyncConsumer : site '{}' introuvable — stock non synchronisé pour lot {}",
                         codeSite, idLot);
                return;
            }

            // UPSERT atomique : crée la ligne si absente, incrémente si existante
            stockRepo.creditQuantite(idLot, codeSite, quantite, unite);

            // Mouvement IN pour traçabilité
            MouvementStock mv = new MouvementStock();
            mv.setIdLot(idLot);
            mv.setTypeMouvement(TypeMouvement.IN);
            mv.setSiteDestination(site);
            mv.setQuantite(quantite);
            mv.setUnite(unite);
            mv.setReferenceOperation("ENTREE-LOT-" + idLot);
            mv.setCreatedAt(Instant.now());
            mouvementRepo.save(mv);

            log.info("LotStockSyncConsumer : lot={} → site={} +{} {} (UPSERT OK)",
                     idLot, codeSite, quantite, unite);

        } catch (Exception e) {
            log.error("LotStockSyncConsumer : erreur traitement message : {}", e.getMessage(), e);
        }
    }
}
