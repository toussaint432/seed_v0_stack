package sn.isra.seed.stock_service.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record StockAgregeDto(
    Long       idVariete,
    Long       idGeneration,
    Long       idSite,
    String     codeSite,
    String     nomSite,
    String     codeGeneration,
    String     nomVariete,
    String     codeVariete,
    String     nomEspece,
    String     codeEspece,
    String     unite,
    BigDecimal quantiteTotale,
    Long       nbLots,
    String     derniereMaj,
    String     createdAt,
    List<LotDetailDto> lotsDetail
) {
    public record LotDetailDto(
        Long       idStock,
        Long       idLot,
        String     codeLot,
        BigDecimal quantite,
        String     unite,
        String     statut,
        String     campagne,
        String     createdAt
    ) {}
}
