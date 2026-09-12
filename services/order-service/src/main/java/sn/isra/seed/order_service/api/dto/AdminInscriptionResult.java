package sn.isra.seed.order_service.api.dto;

/**
 * Réponse retournée après une inscription admin réussie.
 *
 * motDePasseTemporaire est retourné en clair — endpoint réservé à seed-admin,
 * sur réseau interne Docker. L'acteur devra le changer à la première connexion
 * (action Keycloak UPDATE_PASSWORD activée automatiquement).
 */
public record AdminInscriptionResult(

    /** Username créé dans Keycloak et enregistré dans membre_organisation. */
    String username,

    /** Mot de passe temporaire généré (12 chars). À transmettre à l'acteur par SMS/WhatsApp. */
    String motDePasseTemporaire,

    /** ID de l'organisation rattachée (créée ou existante). */
    Long idOrganisation,

    /** Nom de l'organisation. */
    String nomOrganisation,

    /**
     * Code du site principal créé (Cas A uniquement).
     * Null en Cas B : aucun site créé, l'acteur partage les sites existants.
     */
    String codeSitePrincipal,

    /** ID de la ligne membre_organisation créée. */
    Long idMembre,

    /** true = l'acteur est le contact principal de son organisation. */
    boolean estPrincipal,

    /** Message lisible pour affichage dans l'interface d'administration. */
    String message

) {}
