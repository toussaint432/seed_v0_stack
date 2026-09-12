package sn.isra.seed.order_service.api.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * Payload pour la création atomique d'un nouvel acteur de la chaîne semencière.
 *
 * Cas A — idOrganisationExistante = null  : nouvelle org + site principal + compte + membre
 * Cas B — idOrganisationExistante non-null : compte + membre seulement (org et site préexistent)
 */
public record AdminInscriptionRequest(

    // ── Compte Keycloak (toujours obligatoire) ────────────────────────────────

    @NotBlank(message = "Le username Keycloak est obligatoire")
    @Size(min = 3, max = 100, message = "Username entre 3 et 100 caractères")
    @Pattern(regexp = "^[a-z0-9_\\-]+$",
             message = "Username : minuscules, chiffres, tirets et underscores uniquement")
    String username,

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format email invalide")
    @Size(max = 150)
    String email,

    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 80)
    String prenom,

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 80)
    String nom,

    @Size(max = 20)
    String telephone,

    /** Rôle Keycloak exact : seed-multiplicator | seed-quotataire | seed-upsemcl | seed-selector */
    @NotBlank(message = "Le rôle est obligatoire")
    String role,

    /** Espèce de spécialisation pour seed-selector (ex: ARA, RIZ, MIL). Null pour les autres rôles. */
    String specialisation,

    // ── Discrimination Cas A / Cas B ──────────────────────────────────────────

    /**
     * ID de l'organisation existante à rattacher (Cas B).
     * Si null → Cas A : une nouvelle organisation et son site seront créés.
     */
    Long idOrganisationExistante,

    // ── Champs Organisation (Cas A uniquement, ignorés en Cas B) ─────────────

    /** Nom complet de la nouvelle organisation. */
    String nomOrganisation,

    /**
     * Type de la nouvelle organisation.
     * Valeurs : MULTIPLICATEUR | QUOTATAIRE | UPSEMCL | CNRA | COOPERATIVE | DETAILLANT | ONG | AUTRE
     */
    String typeOrganisation,

    String regionOrg,
    String departementOrg,
    String localiteOrg,

    // ── Champs Site principal (Cas A uniquement, ignorés en Cas B) ───────────

    String nomSite,
    String zoneCode,
    Long   idZoneAgro,
    String departementSite,
    Integer idDepartement,
    String localiteSite,

    @DecimalMin(value = "-90.0",  message = "Latitude invalide")
    @DecimalMax(value =  "90.0",  message = "Latitude invalide")
    BigDecimal latitude,

    @DecimalMin(value = "-180.0", message = "Longitude invalide")
    @DecimalMax(value =  "180.0", message = "Longitude invalide")
    BigDecimal longitude

) {}
