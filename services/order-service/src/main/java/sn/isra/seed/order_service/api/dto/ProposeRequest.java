package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de la requête PATCH /api/orders/{id}/proposer (UPSemCL).
 * Chaque item indique le lot source et la quantité proposée pour une ligne de commande.
 */
public record ProposeRequest(
    @NotEmpty(message = "Au moins une proposition est requise")
    @Valid
    List<PropositionItem> propositions
) {
    public record PropositionItem(
        @NotNull(message = "idLigne est obligatoire")
        Long idLigne,

        @NotNull(message = "idLot est obligatoire")
        Long idLot,

        @NotNull(message = "quantiteProposee est obligatoire")
        @Positive(message = "La quantité proposée doit être positive")
        BigDecimal quantiteProposee
    ) {}
}
