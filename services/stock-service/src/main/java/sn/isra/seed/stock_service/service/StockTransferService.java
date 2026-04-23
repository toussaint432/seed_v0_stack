package sn.isra.seed.stock_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.stock_service.entity.MouvementStock;
import sn.isra.seed.stock_service.entity.OutboxEvent;
import sn.isra.seed.stock_service.entity.enums.TypeMouvement;
import sn.isra.seed.stock_service.exception.InsufficientStockException;
import sn.isra.seed.stock_service.repo.MouvementRepo;
import sn.isra.seed.stock_service.repo.OutboxEventRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Séquence atomique : pessimistic-lock → débit → crédit → audit → outbox.
 * Partagé par TransfertController (acceptation explicite via UI) et
 * LotTransferConsumer (synchronisation depuis lot-service via Kafka).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StockTransferService {

    private final StockRepo       stockRepo;
    private final SiteRepo        siteRepo;
    private final MouvementRepo   mouvementRepo;
    private final OutboxEventRepo outboxRepo;
    private final ObjectMapper    om;

    @Transactional
    public void appliquer(Long idLot, String src, String dest,
                          BigDecimal qte, String unite, String codeReference) {

        // 1. Verrou pessimiste + lecture disponible
        BigDecimal disponible = stockRepo.lockAndGetQuantite(idLot, src)
                .orElse(BigDecimal.ZERO);

        // 2. Validation métier
        if (disponible.compareTo(qte) < 0) {
            throw new InsufficientStockException(src, disponible, qte);
        }

        // 3. Débit source (UPDATE natif atomique)
        int updated = stockRepo.debitQuantite(idLot, src, qte);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Impossible de débiter le stock source — site introuvable : " + src);
        }

        // 4. Crédit destination (UPSERT natif)
        stockRepo.creditQuantite(idLot, dest, qte, unite);

        // 5. Piste d'audit
        MouvementStock mouvement = new MouvementStock();
        mouvement.setIdLot(idLot);
        mouvement.setTypeMouvement(TypeMouvement.TRANSFER);
        mouvement.setSiteSource(siteRepo.findByCodeSite(src).orElse(null));
        mouvement.setSiteDestination(siteRepo.findByCodeSite(dest).orElse(null));
        mouvement.setQuantite(qte);
        mouvement.setUnite(unite);
        mouvement.setReferenceOperation(codeReference);
        mouvement.setCreatedAt(Instant.now());
        mouvementRepo.save(mouvement);

        // 6. Outbox — même transaction, durabilité garantie
        try {
            String payload = om.writeValueAsString(Map.of(
                "idLot",               idLot,
                "quantite",            qte,
                "unite",               unite,
                "codeSiteSource",      src,
                "codeSiteDestination", dest,
                "codeReference",       codeReference
            ));
            OutboxEvent event = new OutboxEvent();
            event.setAggregateType("Stock");
            event.setAggregateId(String.valueOf(idLot));
            event.setType("TRANSFER_ACCEPTE");
            event.setPayload(payload);
            outboxRepo.save(event);
        } catch (Exception e) {
            log.error("Impossible de sérialiser l'événement outbox pour la référence {}", codeReference, e);
        }
    }
}
