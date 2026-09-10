package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record DecisionQuotataireRequest(
    @NotNull @NotEmpty @Valid List<DecisionLigne> decisions
) {
    public record DecisionLigne(
        @NotNull Long idLigne,
        boolean accepte,
        String observations
    ) {}
}
