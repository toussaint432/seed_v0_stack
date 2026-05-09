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
    RETIRE,
    /** Déclassée : visible en stock, non vendable comme semence certifiée */
    DECLASS,
    /** En cours de certification par l'organisme compétent */
    EN_COURS_CERT,
    /** Souche génétique conservatoire */
    SOUCHE,
    /** Lot perdu (intempéries, maladie, accident) */
    PERDU
}
