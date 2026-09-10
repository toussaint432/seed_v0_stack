package sn.isra.seed.order_service.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record PropositionR2Request(
    @NotNull @NotEmpty @Valid List<LigneProposition> propositions
) {
    public record LigneProposition(
        @NotNull Long idLigne,
        @NotNull Long idLotSelectionne,
        @NotNull @DecimalMin("0.01") BigDecimal quantiteSelectionnee,
        /** Prix unitaire HT en FCFA/kg — obligatoire pour la facturation */
        @NotNull @DecimalMin("0") BigDecimal prixUnitaireHt,
        /** Taux TVA en % ; null ou absent → 0 (semences certifiées subventionnées) */
        BigDecimal tauxTva
    ) {}
}
