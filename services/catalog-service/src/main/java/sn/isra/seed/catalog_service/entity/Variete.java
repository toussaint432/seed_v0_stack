package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;

import java.time.Instant;

@Entity
@Table(name = "variete")
@Getter @Setter @NoArgsConstructor
public class Variete {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code variété est obligatoire")
    @Size(max = 50)
    @Column(name = "code_variete", unique = true, nullable = false, length = 50)
    private String codeVariete;

    @NotBlank(message = "Le nom de la variété est obligatoire")
    @Size(max = 200)
    @Column(name = "nom_variete", nullable = false, length = 200)
    private String nomVariete;

    @NotNull(message = "L'espèce est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_espece", nullable = false)
    private Espece espece;

    @Size(max = 200)
    private String origine;

    @Size(max = 200)
    @Column(name = "selectionneur_principal", length = 200)
    private String selectionneurPrincipal;

    @Min(value = 1900, message = "L'année de création doit être réaliste")
    @Max(value = 2100)
    @Column(name = "annee_creation")
    private Integer anneeCreation;

    @Positive(message = "Le cycle minimum doit être positif")
    @Max(value = 365, message = "Le cycle minimum ne peut dépasser 365 jours")
    @Column(name = "cycle_min")
    private Integer cycleMin;

    @Positive(message = "Le cycle maximum doit être positif")
    @Max(value = 365, message = "Le cycle maximum ne peut dépasser 365 jours")
    @Column(name = "cycle_max")
    private Integer cycleMax;

    // ── Données agronomiques ISRA/CNRA ────────────────────────

    /** Généalogie génétique — ex : "55-437 × CE 181-22" */
    @Column(name = "pedigree", columnDefinition = "TEXT")
    private String pedigree;

    /** Type de grain — ex : "Virginia (Bold)", "Grain perlé (Blanc)" */
    @Size(max = 50, message = "Le type de grain ne peut dépasser 50 caractères")
    @Column(name = "type_grain", length = 50)
    private String typeGrain;

    /** Rendement potentiel minimum en t/ha */
    @DecimalMin(value = "0.0", message = "Le rendement minimum ne peut être négatif")
    @Column(name = "rendement_min", precision = 4, scale = 1)
    private java.math.BigDecimal rendementMin;

    /** Rendement potentiel maximum en t/ha */
    @DecimalMin(value = "0.0", message = "Le rendement maximum ne peut être négatif")
    @Column(name = "rendement_max", precision = 4, scale = 1)
    private java.math.BigDecimal rendementMax;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "statut_variete", nullable = false, length = 30)
    private StatutVariete statutVariete = StatutVariete.DIFFUSEE;

    @Column(name = "date_creation", updatable = false)
    private Instant dateCreation;

    // ── Soft-delete traçable ──────────────────────────────
    @Column(name = "commentaire_archivage", columnDefinition = "TEXT")
    private String commentaireArchivage;

    @Column(name = "date_archivage")
    private Instant dateArchivage;

    @Size(max = 150)
    @Column(name = "archive_par", length = 150)
    private String archivePar;

    @PrePersist
    void prePersist() {
        if (dateCreation == null) dateCreation = Instant.now();
        if (statutVariete == null) statutVariete = StatutVariete.DIFFUSEE;
    }
}
