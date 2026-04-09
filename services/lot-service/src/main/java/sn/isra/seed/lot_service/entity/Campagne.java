package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutCampagne;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "campagne")
@Getter @Setter @NoArgsConstructor
public class Campagne {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code campagne est obligatoire")
    @Size(max = 50)
    @Column(name = "code_campagne", unique = true, nullable = false, length = 50)
    private String codeCampagne;

    @NotBlank(message = "Le libellé est obligatoire")
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String libelle;

    @NotNull(message = "L'année est obligatoire")
    @Min(value = 2000, message = "Année invalide")
    @Max(value = 2100)
    @Column(nullable = false)
    private Integer annee;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutCampagne statut = StatutCampagne.PLANIFIEE;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statut == null) statut = StatutCampagne.PLANIFIEE;
        if (codeCampagne == null || codeCampagne.isBlank())
            codeCampagne = "CAM-" + (annee != null ? annee : System.currentTimeMillis());
    }
}
