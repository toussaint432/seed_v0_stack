package sn.isra.seed.stock_service.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.math.BigDecimal;

/**
 * Levée lorsqu'une opération de débit dépasse le stock disponible.
 * Produit une réponse HTTP 409 CONFLICT avec un message métier explicite
 * pour que le frontend puisse afficher un toast d'erreur précis.
 */
@ResponseStatus(HttpStatus.CONFLICT)
public class InsufficientStockException extends RuntimeException {

    public InsufficientStockException(String codeSite, BigDecimal disponible, BigDecimal demande) {
        super(String.format(
            "Stock insuffisant au site '%s' — disponible : %s kg, demandé : %s kg",
            codeSite, disponible.stripTrailingZeros().toPlainString(),
            demande.stripTrailingZeros().toPlainString()
        ));
    }
}
