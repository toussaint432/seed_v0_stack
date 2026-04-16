package sn.isra.seed.lot_service.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateChildLotRequest(
    String codeLot,
    Long idVariete,
    String codeEspece,       // optionnel — hérité du parent si absent
    String generationCode,
    String campagne,
    LocalDate dateProduction,
    BigDecimal quantiteNette,
    String unite,
    BigDecimal tauxGermination,
    BigDecimal puretePhysique,
    // Phase 1 : traçabilité acteur
    String responsableNom,
    String responsableRole,
    Long idOrgProducteur
) {}
