package sn.isra.seed.stock_service.api.dto;

import java.math.BigDecimal;

/** Projection native pour v_stock_agrege. */
public interface StockAgregeView {
    Long       getIdVariete();
    Long       getIdGeneration();
    Long       getIdSite();
    String     getCodeSite();
    String     getNomSite();
    String     getZoneCode();
    String     getCodeGeneration();
    String     getNomVariete();
    String     getCodeVariete();
    String     getNomEspece();
    String     getCodeEspece();
    String     getUnite();
    BigDecimal getQuantiteTotale();
    Long       getNbLots();
    String     getDerniereMaj();  // ISO-8601 castée en SQL
    String     getCreatedAt();    // ISO-8601 — première entrée en stock du groupe
    String     getLotsDetail();   // JSON array castée en text
}
