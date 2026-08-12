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
    BigDecimal puretePhysique,
    // Phase 1 : traçabilité acteur
    String responsableNom,
    String responsableRole,
    Long idOrgProducteur,
    // Phase 2 : champs production PCAE
    BigDecimal quantiteSemenceSrcKg,
    BigDecimal superficieHa,
    BigDecimal productionBruteKg,
    String cycle,
    String niveauSemence,
    // Enregistrement stock automatique — optionnel
    String siteCode
) {}
