package sn.isra.seed.lot_service.api.dto;

import sn.isra.seed.lot_service.entity.LotSemencier;
import java.math.BigDecimal;

/**
 * Nœud de l'arbre généalogique — retourné par GET /api/lots/{id}/lineage
 * Inclut les informations de traçabilité acteur (Phase 1)
 */
public record LineageNode(
    Long lotId,
    String codeLot,
    String generation,
    String campagne,
    String dateProduction,
    BigDecimal quantiteNette,
    String unite,
    BigDecimal tauxGermination,
    BigDecimal puretePhysique,
    String statutLot,
    // Phase 1 : traçabilité acteur
    String responsableNom,
    String responsableRole,
    Long idOrgProducteur,
    String usernameCreateur
) {
    public static LineageNode from(LotSemencier lot) {
        return new LineageNode(
            lot.getId(),
            lot.getCodeLot(),
            lot.getGeneration() != null ? lot.getGeneration().getCodeGeneration() : null,
            lot.getCampagne(),
            lot.getDateProduction() != null ? lot.getDateProduction().toString() : null,
            lot.getQuantiteNette(),
            lot.getUnite(),
            lot.getTauxGermination(),
            lot.getPuretePhysique(),
            lot.getStatutLot(),
            lot.getResponsableNom(),
            lot.getResponsableRole(),
            lot.getIdOrgProducteur(),
            lot.getUsernameCreateur()
        );
    }
}
