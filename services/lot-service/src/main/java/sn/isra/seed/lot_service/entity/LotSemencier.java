package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutCertification;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "lot_semencier", schema = "lot",
    indexes = {
        @Index(name = "idx_lot_variete",    columnList = "id_variete"),
        @Index(name = "idx_lot_generation", columnList = "id_generation"),
        @Index(name = "idx_lot_parent",     columnList = "id_lot_parent"),
        @Index(name = "idx_lot_statut",     columnList = "statut_lot")
    }
)
@Getter @Setter @NoArgsConstructor
public class LotSemencier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code lot est obligatoire")
    @Size(max = 80)
    @Column(name = "code_lot", unique = true, nullable = false, length = 80)
    private String codeLot;

    @NotNull(message = "La variété est obligatoire")
    @Column(name = "id_variete", nullable = false)
    private Long idVariete;

    @NotNull(message = "La génération est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_generation", nullable = false)
    private Generation generation;

    /** Auto-référence pour la généalogie G0 → G1 → … → R2 */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_lot_parent")
    private LotSemencier lotParent;

    /** Référence textuelle de la campagne (dénormalisée pour lecture rapide) */
    @Size(max = 50)
    private String campagne;

    /** Référence FK vers la campagne (intégrité forte) */
    @Column(name = "id_campagne")
    private Long idCampagne;

    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Column(name = "date_production")
    private LocalDate dateProduction;

    @DecimalMin(value = "0.0", message = "La quantité ne peut pas être négative")
    @Column(name = "quantite_nette", precision = 14, scale = 2)
    private BigDecimal quantiteNette;

    @NotBlank(message = "L'unité est obligatoire")
    @Size(max = 10)
    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "taux_germination", precision = 5, scale = 2)
    private BigDecimal tauxGermination;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "purete_physique", precision = 5, scale = 2)
    private BigDecimal puretePhysique;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "statut_lot", nullable = false, length = 30)
    private StatutLot statutLot = StatutLot.DISPONIBLE;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    // ── Traçabilité acteurs ────────────────────────────────
    @Column(name = "id_org_producteur")
    private Long idOrgProducteur;

    @Size(max = 150)
    @Column(name = "username_createur", length = 150)
    private String usernameCreateur;

    @Size(max = 150)
    @Column(name = "responsable_nom", length = 150)
    private String responsableNom;

    @Size(max = 100)
    @Column(name = "responsable_role", length = 100)
    private String responsableRole;

    /**
     * Code espèce dénormalisé depuis catalog-service (ex: RIZ, MIL, ARA, MAIS…).
     * Peuplé à la création du lot ; permet le filtrage par spécialisation
     * du sélectionneur sans appel inter-service.
     */
    @Size(max = 30)
    @Column(name = "code_espece", length = 30)
    private String codeEspece;

    // ── Champs production PCAE ─────────────────────────────
    @Column(name = "superficie_ha", precision = 10, scale = 2)
    private BigDecimal superficieHa;

    @Column(name = "production_brute_kg", precision = 14, scale = 2)
    private BigDecimal productionBruteKg;

    /** Calculé automatiquement : productionBruteKg / superficieHa */
    @Column(name = "rendement_kg_ha", precision = 10, scale = 2)
    private BigDecimal rendementKgHa;

    /** 'C' = Court, 'L' = Long */
    @Column(name = "cycle", length = 1)
    private String cycle;

    /** Ex : "3 Semences de base G3" */
    @Size(max = 50)
    @Column(name = "niveau_semence", length = 50)
    private String niveauSemence;

    /** Kg de semences du lot parent utilisés pour planter cette campagne */
    @Column(name = "quantite_semence_src_kg", precision = 14, scale = 2)
    private BigDecimal quantiteSemenceSrcKg;

    /** Chemin relatif du certificat officiel (PDF ou image) attaché à ce lot */
    @Size(max = 500)
    @Column(name = "certificat_path", length = 500)
    private String certificatPath;

    // ── Workflow certification (G4/R1/R2) ─────────────────────
    /** Rouge=SANS_CERTIFICAT → Jaune=EN_ATTENTE → Vert=CERTIFIE | Rouge=REJETE */
    @Enumerated(EnumType.STRING)
    @Column(name = "statut_certification", nullable = false, length = 20)
    private StatutCertification statutCertification = StatutCertification.SANS_CERTIFICAT;

    @Size(max = 150)
    @Column(name = "approbateur_username", length = 150)
    private String approbateurUsername;

    @Column(name = "date_approbation")
    private java.time.Instant dateApprobation;

    @Column(name = "motif_rejet_cert", columnDefinition = "TEXT")
    private String motifRejetCert;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statutLot == null) statutLot = StatutLot.DISPONIBLE;
        if (unite == null) unite = "kg";
        if (statutCertification == null) statutCertification = StatutCertification.SANS_CERTIFICAT;
    }
}
