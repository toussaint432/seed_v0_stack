package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Corps de PATCH /api/orders/{id}/decision-multiplicateur.
 * Le multiplicateur accepte ou refuse chaque ligne individuellement.
 */
public record DecisionMultiplicateurRequest(
    @NotEmpty @Valid List<DecisionLigne> decisions,
    String siteDestinationCode
) {
    public record DecisionLigne(
        @NotNull Long idLigne,
        @NotNull boolean accepte,
        String motifRefus
    ) {}
}
