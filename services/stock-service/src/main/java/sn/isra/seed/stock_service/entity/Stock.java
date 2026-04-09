package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "stock",
    uniqueConstraints = @UniqueConstraint(columnNames = {"id_lot", "id_site"}),
    indexes = {
        @Index(name = "idx_stock_lot",  columnList = "id_lot"),
        @Index(name = "idx_stock_site", columnList = "id_site")
    }
)
@Getter @Setter @NoArgsConstructor
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @NotNull(message = "Le site est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_site", nullable = false)
    private Site site;

    @NotNull(message = "La quantité disponible est obligatoire")
    @DecimalMin(value = "0.0", message = "La quantité ne peut pas être négative")
    @Column(name = "quantite_disponible", nullable = false, precision = 14, scale = 2)
    private BigDecimal quantiteDisponible = BigDecimal.ZERO;

    @NotBlank(message = "L'unité est obligatoire")
    @Size(max = 10)
    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
