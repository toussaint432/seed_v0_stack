package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "programme_multiplication")
@Getter @Setter @NoArgsConstructor
public class Programme {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_programme", unique = true, nullable = false)
    private String codeProgramme;

    @Column(name = "id_lot")
    private Long idLot;

    @Column(name = "id_organisation")
    private Long idOrganisation;

    @Column(name = "generation_cible", nullable = false)
    private String generationCible;

    @Column(name = "superficie_ha")
    private BigDecimal superficieHa;

    @Column(name = "objectif_kg")
    private BigDecimal objectifKg;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(nullable = false)
    private String statut = "PLANIFIE";

    private String observations;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (codeProgramme == null || codeProgramme.isBlank())
            codeProgramme = "PRG-" + System.currentTimeMillis();
    }
}
