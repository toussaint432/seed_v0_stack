package sn.isra.seed.stock_service.api.dto;

import java.math.BigDecimal;

public record UpsertStockRequest(
  Long idLot,
  String siteCode,
  BigDecimal quantite,
  String unite
) {}
