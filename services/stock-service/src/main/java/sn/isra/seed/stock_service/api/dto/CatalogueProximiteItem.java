package sn.isra.seed.stock_service.api.dto;

/** Projection catalogue avec distance haversine (km) depuis les coordonnées du quotataire. */
public interface CatalogueProximiteItem extends CatalogueItem {
    Double getDistanceKm();
}
