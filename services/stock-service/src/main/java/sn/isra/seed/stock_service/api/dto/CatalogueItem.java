package sn.isra.seed.stock_service.api.dto;

/** Projection interface pour le catalogue public des stocks R1/R2. */
public interface CatalogueItem {
    Long   getVarieteId();
    String getNomVariete();
    String getCodeVariete();
    String getNomEspece();
    String getCodeEspece();
    Long   getLotId();
    String getCodeLot();
    String getGeneration();
    String getCampagne();
    Double getTauxGermination();
    Double getQuantiteDisponible();
    String getUnite();
    Long   getSiteId();
    String getNomSite();
    String getRegion();
    Long   getOrganisationId();
    String getNomOrganisation();
    Double getLatitude();
    Double getLongitude();
    String getNiveauAdaptation();
    /** JSON : [{"idZone":1,"niveau":"OPTIMAL"}, ...] — toutes ZAE de la variété */
    String getZonesAdaptation();
    String getNomComplet();
    /** Téléphone du membre agréé (COALESCE membre → organisation) */
    String getTelephone();
    /** Localité du site (COALESCE site → organisation) */
    String getLocalite();
    /** Département du site */
    String getDepartement();
}
