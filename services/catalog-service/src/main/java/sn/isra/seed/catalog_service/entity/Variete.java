package sn.isra.seed.catalog_service.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_espece", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    @Positive(message = "Le cycle en jours doit être positif")
    @Column(name = "cycle_jours")
    private Integer cycleJours;

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
