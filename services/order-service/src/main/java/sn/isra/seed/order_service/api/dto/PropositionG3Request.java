package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de POST /api/orders/{id}/propositions-g3 (UPSemCL).
 * L'agent soumet sa proposition FIFO-DSS pour chaque ligne :
 * le lot suggéré par FIFO + son choix final (peut différer avec motif obligatoire).
 *
 * Prix et TVA sont obligatoires depuis V84 : sans eux, la facture auto (Étape 4)
 * ne peut pas être générée lors du déclencheur atomique confirmer-et-transferer.
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

        String motifOverride,

        /** Prix unitaire HT en FCFA/kg — obligatoire pour la génération auto de facture */
        @NotNull @DecimalMin("0") BigDecimal prixUnitaireHt,

        /** Taux TVA : 0.00 (exonéré) ou 18.00 (standard) */
        @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal tauxTva
    ) {}
}
