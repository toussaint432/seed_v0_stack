package sn.isra.seed.order_service.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;

  public void orderCreated(String json) {
    try {
      kafkaTemplate.send("order.created", json);
    } catch (Exception e) {
      log.warn("Kafka indisponible — événement order.created non publié : {}", e.getMessage());
    }
  }
}
