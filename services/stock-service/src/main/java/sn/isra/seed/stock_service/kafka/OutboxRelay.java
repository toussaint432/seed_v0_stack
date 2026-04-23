package sn.isra.seed.stock_service.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sn.isra.seed.stock_service.entity.OutboxEvent;
import sn.isra.seed.stock_service.repo.OutboxEventRepo;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Relaie les événements outbox non publiés vers Kafka.
 * Lit les 50 plus anciens événements non traités, les publie un par un,
 * puis les marque processed=TRUE seulement après confirmation Kafka.
 * Si Kafka est indisponible, le relay s'arrête et reprend au prochain tick.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxRelay {

    private static final String TOPIC = "stock.transfer.accepte";

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
