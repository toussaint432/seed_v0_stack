package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Parcelle physique rattachée à un programme de multiplication.
 * Chaque programme peut couvrir plusieurs parcelles réparties sur des sites différents.
 */
@Entity
@Table(name = "parcelle_multiplication",
    indexes = @Index(name = "idx_parcelle_prog", columnList = "id_programme"))
@Getter @Setter @NoArgsConstructor
public class ParcelleMultiplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le programme est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_programme", nullable = false)
    private Programme programme;

    @NotBlank(message = "Le code parcelle est obligatoire")
    @Size(max = 50)
    @Column(name = "code_parcelle", unique = true, nullable = false, length = 50)
    private String codeParcelle;

    @NotNull(message = "La superficie est obligatoire")
    @Positive(message = "La superficie doit être positive")
    @Column(name = "superficie_ha", nullable = false, precision = 12, scale = 3)
    private BigDecimal superficieHa;

    @Size(max = 200)
    private String localite;

    @Column(name = "date_semis")
    private LocalDate dateSemis;

    @Column(name = "date_recolte_prevue")
    private LocalDate dateRecoltePrevue;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
