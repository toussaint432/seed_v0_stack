package sn.isra.seed.stock_service.api.dto;

import java.math.BigDecimal;

public record MovementRequest(
  Long idLot,
  String type,              // IN, OUT, TRANSFER
  String siteSourceCode,
  String siteDestinationCode,
  BigDecimal quantite,
  String unite,
  String reference
) {}
