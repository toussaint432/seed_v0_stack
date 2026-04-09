package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "controle_qualite",
    indexes = @Index(name = "idx_ctrl_lot", columnList = "id_lot"))
@Getter @Setter @NoArgsConstructor
public class ControleQualite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @NotNull(message = "Le type de contrôle est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "type_controle", nullable = false, length = 30)
    private sn.isra.seed.lot_service.entity.enums.TypeControle typeControle;

    @NotNull(message = "La date de contrôle est obligatoire")
    @Column(name = "date_controle", nullable = false)
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateControle;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "taux_germination", precision = 5, scale = 2)
    private BigDecimal tauxGermination;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "taux_humidite", precision = 5, scale = 2)
    private BigDecimal tauxHumidite;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "purete_physique", precision = 5, scale = 2)
    private BigDecimal puretePhysique;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    @Column(name = "purete_specifique", precision = 5, scale = 2)
    private BigDecimal pureteSpecifique;

    @Column(name = "conformite_varietale", length = 30)
    private String conformiteVarietale;

    @NotNull(message = "Le résultat est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "resultat", nullable = false, length = 30)
    private sn.isra.seed.lot_service.entity.enums.ResultatControle resultat;

    @Column(name = "controleur")
    private String controleur;

    @Column(name = "observations")
    private String observations;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() { this.createdAt = Instant.now(); }
}
