package sn.isra.seed.lot_service.api.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
public record CreateChildLotRequest(
  String codeLot,
  Long idVariete,
  String generationCode,
  String campagne,
  LocalDate dateProduction,
  BigDecimal quantiteNette,
  String unite,
  BigDecimal tauxGermination,
  BigDecimal puretePhysique
) {}
