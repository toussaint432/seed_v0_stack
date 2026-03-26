package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "campagne")
@Getter @Setter @NoArgsConstructor
public class Campagne {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_campagne", unique = true, nullable = false)
    private String codeCampagne;

    @Column(nullable = false)
    private String libelle;

    @Column(nullable = false)
    private Integer annee;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(nullable = false)
    private String statut = "PLANIFIEE";

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (codeCampagne == null || codeCampagne.isBlank())
            codeCampagne = "CAM-" + (annee != null ? annee : System.currentTimeMillis());
    }
}
