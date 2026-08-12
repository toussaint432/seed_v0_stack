package sn.isra.seed.lot_service.api.dto;

import sn.isra.seed.lot_service.entity.enums.StatutCertification;
import sn.isra.seed.lot_service.entity.enums.StatutLot;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Projection plate de LotSemencier exposée par l'API.
 * Remplace les relations EAGER (generation, lotParent) par des champs scalaires
 * pour éviter la sérialisation récursive de la chaîne G0→G1→...→R2.
 */
public record LotSemencierDto(
    Long          id,
    String        codeLot,
    Long          idVariete,
    String        codeEspece,

    // Génération aplatie
    Long          generationId,
    String        generationCode,
    Integer       generationOrdre,

    // Lot parent aplati (pas de récursion)
    Long          lotParentId,
    String        lotParentCode,

    String        campagne,
    Long          idCampagne,
    LocalDate     dateProduction,
    BigDecimal    quantiteNette,
    String        unite,
    BigDecimal    tauxGermination,
    BigDecimal    puretePhysique,
    StatutLot     statutLot,
    Instant       createdAt,

    // Traçabilité
    Long          idOrgProducteur,
    String        usernameCreateur,
    String        responsableNom,
    String        responsableRole,

    // Production PCAE
    BigDecimal    superficieHa,
    BigDecimal    productionBruteKg,
    BigDecimal    rendementKgHa,
    String        cycle,
    String        niveauSemence,
    BigDecimal    quantiteSemenceSrcKg,

    // Certification
    String            certificatPath,
    StatutCertification statutCertification,
    String            approbateurUsername,
    Instant           dateApprobation,
    String            motifRejetCert
) {}
