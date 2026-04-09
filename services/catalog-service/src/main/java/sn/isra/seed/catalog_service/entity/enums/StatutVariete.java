package sn.isra.seed.catalog_service.entity.enums;

public enum StatutVariete {
    /** Variété validée et distribuée aux acteurs de la chaîne */
    DIFFUSEE,
    /** En cours d'évaluation agronomique */
    EN_TEST,
    /** Retirée du catalogue (plus commercialisée) */
    RETIREE,
    /** Archivée (soft-delete — conservation pour historique) */
    ARCHIVEE
}
