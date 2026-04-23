package sn.isra.seed.lot_service.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sn.isra.seed.lot_service.entity.OutboxEvent;
import sn.isra.seed.lot_service.repo.OutboxEventRepo;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Relaie les événements outbox du lot-service vers Kafka (lot.transfer.accepte).
 * Le stock-service consomme ce topic pour synchroniser le stock physique.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotOutboxRelay {

    private static final String TOPIC = "lot.transfer.accepte";

    private final OutboxEventRepo                outboxRepo;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEvent> pending = outboxRepo.findTop50ByProcessedFalseOrderByCreatedAtAsc();
        if (pending.isEmpty()) return;

        for (OutboxEvent event : pending) {
            try {
                kafkaTemplate.send(TOPIC, event.getAggregateId(), event.getPayload())
                             .get(5, TimeUnit.SECONDS);
                outboxRepo.markProcessed(event.getId());
                log.debug("Outbox → Kafka [{}] id={}", TOPIC, event.getId());
            } catch (Exception e) {
                log.warn("Kafka indisponible — outbox event {} reporté : {}",
                         event.getId(), e.getMessage());
                break;
            }
        }
    }
}
