package sn.isra.seed.order_service.entity.enums;

public enum StatutCommande {
    /** Commande soumise par le multiplicateur, en attente de traitement UPSemCL */
    SOUMISE,
    /** UPSemCL a proposé une quantité/lot — négociation en cours */
    EN_NEGOCIATION,
    /** Multiplicateur a accepté la proposition de l'UPSemCL */
    ACCORDEE,
    /** UPSemCL a déclenché le transfert physique — en cours de livraison */
    EN_LIVRAISON,
    /** Multiplicateur a accusé réception — lot crédité dans son stock */
    LIVREE,
    /** Annulée par le client ou l'UPSemCL */
    ANNULEE,
    /** Rejetée par le fournisseur */
    REJETEE,
    /** Acceptée (flux legacy / quotataire) — et désormais verrou contractuel du flux G3/R2 */
    ACCEPTEE,
    /** En cours de préparation (flux legacy) */
    EN_PREPARATION,
    /** Transfert déclenché de manière atomique par le vendeur (lot + stock + facture + bordereau) */
    TRANSFERE,
    /** Réception physique confirmée par l'acheteur — peut comporter un commentaire de contestation */
    RECEPTIONNEE
}
