package sn.isra.seed.lot_service.kafka;

import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LotEventProducer {
  private final KafkaTemplate<String, String> kafkaTemplate;

  public void lotCreated(String payloadJson) {
    kafkaTemplate.send("lot.created", payloadJson);
  }
}
