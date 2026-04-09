package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutProgramme;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "programme_multiplication")
@Getter @Setter @NoArgsConstructor
public class Programme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code programme est obligatoire")
    @Size(max = 80)
    @Column(name = "code_programme", unique = true, nullable = false, length = 80)
    private String codeProgramme;

    /** Lot semencier source de la multiplication */
    @Column(name = "id_lot_source")
    private Long idLot;

    @Column(name = "id_organisation")
    private Long idOrganisation;

    @NotBlank(message = "La génération cible est obligatoire")
    @Size(max = 10)
    @Column(name = "generation_cible", nullable = false, length = 10)
    private String generationCible;

    @Positive(message = "La superficie doit être positive")
    @Column(name = "superficie_ha", precision = 12, scale = 3)
    private BigDecimal superficieHa;

    @Positive(message = "L'objectif en kg doit être positif")
    @Column(name = "objectif_kg", precision = 14, scale = 2)
    private BigDecimal objectifKg;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutProgramme statut = StatutProgramme.PLANIFIE;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statut == null) statut = StatutProgramme.PLANIFIE;
        if (codeProgramme == null || codeProgramme.isBlank())
            codeProgramme = "PRG-" + System.currentTimeMillis();
    }
}
