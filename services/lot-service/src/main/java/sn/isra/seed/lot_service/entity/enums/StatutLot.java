package sn.isra.seed.lot_service.entity.enums;

public enum StatutLot {
    /** Lot disponible pour multiplication ou distribution */
    DISPONIBLE,
    /** En cours de multiplication sur parcelle */
    EN_PRODUCTION,
    /** Lot certifié par organisme compétent */
    CERTIFIE,
    /** Lot transféré à un autre acteur */
    TRANSFERE,
    /** Stock totalement épuisé */
    EPUISE,
    /** Retiré de la chaîne (non-conformité, péremption) */
    RETIRE
}
