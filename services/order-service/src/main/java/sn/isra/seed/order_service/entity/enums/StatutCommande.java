package sn.isra.seed.order_service.entity.enums;

public enum StatutCommande {
    /** Commande soumise par le client, en attente de traitement */
    SOUMISE,
    /** Acceptée par le fournisseur */
    ACCEPTEE,
    /** En cours de préparation (allocation des lots) */
    EN_PREPARATION,
    /** Livrée au client */
    LIVREE,
    /** Annulée par le client */
    ANNULEE,
    /** Rejetée par le fournisseur */
    REJETEE
}
