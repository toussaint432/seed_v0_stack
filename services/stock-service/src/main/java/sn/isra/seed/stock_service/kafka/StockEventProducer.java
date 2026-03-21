package sn.isra.seed.stock_service.kafka;

import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StockEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;

  public void stockUpdated(String json) { kafkaTemplate.send("stock.updated", json); }
  public void stockMoved(String json) { kafkaTemplate.send("stock.moved", json); }
}
