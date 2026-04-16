package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.stock_service.entity.enums.TypeMouvement;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "mouvement_stock",
    indexes = {
        @Index(name = "idx_mvt_lot",  columnList = "id_lot"),
        @Index(name = "idx_mvt_date", columnList = "created_at")
    }
)
@Getter @Setter @NoArgsConstructor
public class MouvementStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @NotNull(message = "Le type de mouvement est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "type_mouvement", nullable = false, length = 20)
    private TypeMouvement typeMouvement;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_site_source")
    private Site siteSource;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_site_destination")
    private Site siteDestination;

    @NotNull(message = "La quantité est obligatoire")
    @Positive(message = "La quantité doit être positive")
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal quantite;

    @NotBlank(message = "L'unité est obligatoire")
    @Size(max = 10)
    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @Size(max = 80)
    @Column(name = "reference_operation", length = 80)
    private String referenceOperation;

    /** Traçabilité : qui a réalisé l'opération */
    @Size(max = 150)
    @Column(name = "username_operateur", length = 150)
    private String usernameOperateur;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (unite == null) unite = "kg";
    }
}
