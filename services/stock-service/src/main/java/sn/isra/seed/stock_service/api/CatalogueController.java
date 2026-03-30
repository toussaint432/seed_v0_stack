package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.api.dto.CatalogueItem;
import sn.isra.seed.stock_service.api.dto.CatalogueProximiteItem;
import sn.isra.seed.stock_service.repo.StockRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/stocks")
@RequiredArgsConstructor
public class CatalogueController {

    private final StockRepo stockRepo;

    /**
     * GET /api/stocks/catalogue
     * Retourne les stocks R1/R2 disponibles chez les multiplicateurs.
     * Paramètres optionnels : espece, idZone.
     */
    @GetMapping("/catalogue")
    public List<CatalogueItem> getCatalogue(
            @RequestParam(required = false) String espece,
            @RequestParam(required = false) Long idZone) {

        String codeEspece = (espece == null || espece.isBlank()) ? null : espece.trim().toUpperCase();
        return stockRepo.findCatalogue(codeEspece, idZone);
    }

    /**
     * GET /api/stocks/catalogue/proximite
     * Stocks R1/R2 dans un rayon (km) depuis les coordonnées GPS du quotataire.
     * Paramètres : lat, lng, rayonKm (défaut 100), idVariete (optionnel).
     * Tri : distance ASC.
     */
    @GetMapping("/catalogue/proximite")
    public List<CatalogueProximiteItem> getProximite(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "100") double rayonKm,
            @RequestParam(required = false) Long idVariete) {

        return stockRepo.findCatalogueProximite(lat, lng, rayonKm, idVariete);
    }
}
