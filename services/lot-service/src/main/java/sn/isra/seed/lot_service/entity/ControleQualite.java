package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "controle_qualite")
@Getter @Setter @NoArgsConstructor
public class ControleQualite {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(name = "type_controle", nullable = false)
    private String typeControle;

    @Column(name = "date_controle", nullable = false)
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateControle;

    @Column(name = "taux_germination")
    private BigDecimal tauxGermination;

    @Column(name = "taux_humidite")
    private BigDecimal tauxHumidite;

    @Column(name = "purete_physique")
    private BigDecimal puretePhysique;

    @Column(name = "purete_specifique")
    private BigDecimal pureteSpecifique;

    @Column(name = "conformite_varietale")
    private String conformiteVarietale;

    @Column(name = "resultat", nullable = false)
    private String resultat;

    @Column(name = "controleur")
    private String controleur;

    @Column(name = "observations")
    private String observations;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() { this.createdAt = Instant.now(); }
}
