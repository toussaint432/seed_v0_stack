package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutLot;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "lot_semencier",
    indexes = {
        @Index(name = "idx_lot_variete",    columnList = "id_variete"),
        @Index(name = "idx_lot_generation", columnList = "id_generation"),
        @Index(name = "idx_lot_parent",     columnList = "id_lot_parent"),
        @Index(name = "idx_lot_statut",     columnList = "statut_lot")
    }
)
@Getter @Setter @NoArgsConstructor
public class LotSemencier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code lot est obligatoire")
    @Size(max = 80)
    @Column(name = "code_lot", unique = true, nullable = false, length = 80)
    private String codeLot;

    @NotNull(message = "La variété est obligatoire")
    @Column(name = "id_variete", nullable = false)
    private Long idVariete;

    @NotNull(message = "La génération est obligatoire")
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_generation", nullable = false)
    private Generation generation;

    /** Auto-référence pour la généalogie G0 → G1 → … → R2 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_lot_parent")
    private LotSemencier lotParent;

    /** Référence textuelle de la campagne (dénormalisée pour lecture rapide) */
    @Size(max = 50)
    private String campagne;

    /** Référence FK vers la campagne (intégrité forte) */
    @Column(name = "id_campagne")
    private Long idCampagne;

    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Column(name = "date_production")
    private LocalDate dateProduction;

    @DecimalMin(value = "0.0", message = "La quantité ne peut pas être négative")
    @Column(name = "quantite_nette", precision = 14, scale = 2)
    private BigDecimal quantiteNette;

    @NotBlank(message = "L'unité est obligatoire")
    @Size(max = 10)
    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "taux_germination", precision = 5, scale = 2)
    private BigDecimal tauxGermination;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "purete_physique", precision = 5, scale = 2)
    private BigDecimal puretePhysique;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "statut_lot", nullable = false, length = 30)
    private StatutLot statutLot = StatutLot.DISPONIBLE;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    // ── Traçabilité acteurs ────────────────────────────────
    @Column(name = "id_org_producteur")
    private Long idOrgProducteur;

    @Size(max = 150)
    @Column(name = "username_createur", length = 150)
    private String usernameCreateur;

    @Size(max = 150)
    @Column(name = "responsable_nom", length = 150)
    private String responsableNom;

    @Size(max = 100)
    @Column(name = "responsable_role", length = 100)
    private String responsableRole;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statutLot == null) statutLot = StatutLot.DISPONIBLE;
        if (unite == null) unite = "kg";
    }
}
