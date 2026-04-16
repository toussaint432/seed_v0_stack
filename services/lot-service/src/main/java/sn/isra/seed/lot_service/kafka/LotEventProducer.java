package sn.isra.seed.lot_service.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LotEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;

  public void lotCreated(String payloadJson) {
    try {
      kafkaTemplate.send("lot.created", payloadJson);
    } catch (Exception e) {
      log.warn("Kafka indisponible — événement lot.created non publié : {}", e.getMessage());
    }
  }
}
