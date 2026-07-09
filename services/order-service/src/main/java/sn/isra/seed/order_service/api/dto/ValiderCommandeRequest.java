package sn.isra.seed.order_service.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de la requête POST /api/orders/{id}/valider-et-livrer.
 * Permet à l'agent UPSemCL de valider et livrer une commande G3
 * en une seule action : allocation d'un lot spécifique + livraison immédiate.
 *
 * Chaque AllocationItem associe une ligne de commande à un lot physique
 * et à la quantité effectivement transférée.
 */
public record ValiderCommandeRequest(
    @NotEmpty(message = "Au moins une allocation est requise")
    List<AllocationItem> allocations
) {
    /**
     * Représente l'affectation d'un lot concret à une ligne de commande.
     * idLigne  : identifiant de la LigneCommande concernée
     * idLot    : identifiant du lot G3 sélectionné par l'agent UPSemCL
     * quantite : quantité réellement transférée (peut être ≤ quantiteDemandee)
     */
    public record AllocationItem(
        @NotNull(message = "idLigne est obligatoire") Long idLigne,
        @NotNull(message = "idLot est obligatoire")   Long idLot,
        @Positive(message = "La quantité doit être strictement positive") BigDecimal quantite
    ) {}
}
