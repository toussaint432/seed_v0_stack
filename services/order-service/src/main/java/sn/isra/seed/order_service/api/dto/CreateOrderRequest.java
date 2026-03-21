package sn.isra.seed.order_service.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record CreateOrderRequest(
  String codeCommande,
  String client,
  List<Line> lignes
) {
  public record Line(Long idVariete, Long idGeneration, BigDecimal quantite, String unite) {}
}
