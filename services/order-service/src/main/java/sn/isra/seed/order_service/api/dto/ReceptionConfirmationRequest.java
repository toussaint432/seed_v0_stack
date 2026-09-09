package sn.isra.seed.order_service.api.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Corps de POST /api/orders/{id}/confirmer-reception (Multiplicateur).
 * Confirmation de réception avec déclaration des écarts éventuels.
 */
public record ReceptionConfirmationRequest(
    String observations,
    List<EcartLot> ecarts
) {
    public record EcartLot(
        Long idLotSource,
        BigDecimal quantiteTransferee,
        BigDecimal quantiteRecue,
        String observations
    ) {}
}
