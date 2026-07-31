package sn.isra.seed.lot_service.entity.enums;

public enum StatutCertification {
    /** Aucun certificat uploadé — lot affiché en rouge */
    SANS_CERTIFICAT,
    /** Multiplicateur a uploadé un certificat — en attente de validation UPSemCL/Admin (jaune) */
    EN_ATTENTE,
    /** Approuvé par UPSemCL ou Admin — lot certifié (vert) */
    CERTIFIE,
    /** Rejeté par UPSemCL ou Admin — retour rouge avec motif */
    REJETE
}
