package sn.isra.seed.stock_service.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StockEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;

  public void stockUpdated(String json) {
    try {
      kafkaTemplate.send("stock.updated", json);
    } catch (Exception e) {
      log.warn("Kafka indisponible — événement stock.updated non publié : {}", e.getMessage());
    }
  }

  public void stockMoved(String json) {
    try {
      kafkaTemplate.send("stock.moved", json);
    } catch (Exception e) {
      log.warn("Kafka indisponible — événement stock.moved non publié : {}", e.getMessage());
    }
  }
}
