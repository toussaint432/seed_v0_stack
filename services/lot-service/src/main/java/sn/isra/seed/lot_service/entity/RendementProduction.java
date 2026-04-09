package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Résultats de récolte pour un programme de multiplication.
 * Permet de calculer le ratio objectif/réel et le taux de perte.
 */
@Entity
@Table(name = "rendement_production",
    indexes = @Index(name = "idx_rendement_prog", columnList = "id_programme"))
@Getter @Setter @NoArgsConstructor
public class RendementProduction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le programme est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_programme", nullable = false)
    private Programme programme;

    /** Parcelle optionnelle — si null, concerne tout le programme */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_parcelle")
    private ParcelleMultiplication parcelle;

    @DecimalMin(value = "0.0", message = "Le rendement ne peut être négatif")
    @Column(name = "rendement_reel_kg_ha", precision = 10, scale = 2)
    private BigDecimal rendementReelKgHa;

    @DecimalMin(value = "0.0", message = "La quantité récoltée ne peut être négative")
    @Column(name = "quantite_recoltee_totale", precision = 14, scale = 2)
    private BigDecimal quantiteRecolteetTotale;

    @Column(name = "date_recolte")
    private LocalDate dateRecolte;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "taux_perte_pct", precision = 5, scale = 2)
    private BigDecimal tauxPertePct;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
