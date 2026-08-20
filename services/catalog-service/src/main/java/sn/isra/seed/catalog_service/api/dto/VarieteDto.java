package sn.isra.seed.catalog_service.api.dto;

import sn.isra.seed.catalog_service.entity.enums.StatutVariete;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Projection plate de Variete exposée par l'API.
 * Remplace la relation EAGER Espece par des champs scalaires.
 */
public record VarieteDto(
    Long          id,
    String        codeVariete,
    String        nomVariete,

    // Espèce aplatie
    Long          especeId,
    String        especeCode,
    String        especeNomCommun,

    String        origine,
    String        selectionneurPrincipal,
    Integer       anneeCreation,
    Integer       cycleMin,
    Integer       cycleMax,
    String        pedigree,
    String        typeGrain,
    BigDecimal    rendementMin,
    BigDecimal    rendementMax,
    StatutVariete statutVariete,
    Instant       dateCreation,
    String        ficheVarietalePath,

    // Catalogue officiel ISRA/CNRA
    Integer       anneeHomologation,
    String        natureGenetique,
    String        numeroSelection,
    String        vocationCulturale,
    String        photosensibilite,
    String        synonyme,
    String        itineraireTechPath,

    // Archivage (retourné pour l'affichage admin)
    String        commentaireArchivage,
    Instant       dateArchivage,
    String        archivePar
) {}
