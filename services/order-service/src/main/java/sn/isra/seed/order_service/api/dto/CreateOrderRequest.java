package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de la requête de création d'une commande.
 * Validation Bean Validation activée via @Valid dans OrderController.
 */
public record CreateOrderRequest(

    @NotBlank(message = "Le code commande est obligatoire")
    String codeCommande,

    @NotBlank(message = "Le nom du client est obligatoire")
    String client,

    Long idOrganisationFournisseur,

    String observations,

    @NotEmpty(message = "La commande doit contenir au moins une ligne")
    @Valid
    List<Line> lignes

) {
    /** Ligne de commande : variété, génération, quantité. */
    public record Line(

        @NotNull(message = "L'identifiant de la variété est obligatoire")
        Long idVariete,

        Long idGeneration,

        @NotNull(message = "La quantité est obligatoire")
        @DecimalMin(value = "0.01", inclusive = true, message = "La quantité doit être supérieure à 0")
        BigDecimal quantite,

        String unite
    ) {}
}
