package sn.isra.seed.stock_service.api.dto;

import sn.isra.seed.stock_service.entity.enums.TypeSite;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Projection plate de Stock exposée par l'API.
 * Remplace la relation EAGER Site par des champs scalaires.
 */
public record StockDto(
    Long       id,
    Long       idLot,

    // Site aplati
    Long       siteId,
    String     codeSite,
    String     nomSite,
    TypeSite   typeSite,
    String     localite,
    String     region,

    BigDecimal quantiteDisponible,
    String     unite,
    Instant    updatedAt,
    Instant    createdAt
) {}
