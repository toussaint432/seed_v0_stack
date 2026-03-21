package sn.isra.seed.order_service.kafka;

import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;
  public void orderCreated(String json) { kafkaTemplate.send("order.created", json); }
}
