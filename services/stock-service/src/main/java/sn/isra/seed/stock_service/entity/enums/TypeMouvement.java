package sn.isra.seed.stock_service.entity.enums;

public enum TypeMouvement {
    /** Entrée en stock (réception, production) */
    IN,
    /** Sortie de stock (distribution, transfert sortant) */
    OUT,
    /** Transfert inter-sites (source → destination) */
    TRANSFER
}
