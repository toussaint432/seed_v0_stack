package sn.isra.seed.stock_service.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Corps de la requête de création ou mise à jour d'un stock.
 * Validation Bean Validation activée via @Valid dans StockController.
 */
public record UpsertStockRequest(

    @NotNull(message = "L'identifiant du lot est obligatoire")
    Long idLot,

    @NotBlank(message = "Le code site est obligatoire")
    String siteCode,

    @NotNull(message = "La quantité est obligatoire")
    @DecimalMin(value = "0.0", inclusive = true, message = "La quantité ne peut pas être négative")
    BigDecimal quantite,

    String unite

) {}
