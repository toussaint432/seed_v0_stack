package sn.isra.seed.order_service.api.dto;

import java.math.BigDecimal;

public record AllocateRequest(
  Long idLigne,
  Long idLot,
  BigDecimal quantite
) {}
