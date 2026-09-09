package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de POST /api/orders/{id}/propositions-g3 (UPSemCL).
 * L'agent soumet sa proposition FIFO-DSS pour chaque ligne :
 * le lot suggéré par FIFO + son choix final (peut différer avec motif obligatoire).
 */
public record PropositionG3Request(
    @NotEmpty @Valid List<LigneProposition> propositions
) {
    public record LigneProposition(
        @NotNull Long idLigne,

        Long idLotSuggereFifo,
        BigDecimal quantiteSuggere,

        @NotNull Long idLotSelectionne,

        @NotNull @Positive BigDecimal quantiteSelectionnee,

        String motifOverride
    ) {}
}
