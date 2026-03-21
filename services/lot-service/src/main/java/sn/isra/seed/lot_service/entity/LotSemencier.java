package sn.isra.seed.lot_service.entity;
import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import java.time.Instant;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name="lot_semencier")
@Getter @Setter @NoArgsConstructor
public class LotSemencier {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;
  @Column(name="code_lot", unique=true, nullable=false)
  private String codeLot;
  @Column(name="id_variete", nullable=false)
  private Long idVariete;
  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_generation")
  private Generation generation;
  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="id_lot_parent")
  private LotSemencier lotParent;
  private String campagne;
  @Column(name="date_production")
  @JsonSerialize(using=LocalDateSerializer.class)
  @JsonDeserialize(using=LocalDateDeserializer.class)
  @JsonFormat(shape=JsonFormat.Shape.STRING, pattern="yyyy-MM-dd")
  private LocalDate dateProduction;
  @Column(name="quantite_nette")
  private BigDecimal quantiteNette;
  private String unite;
  @Column(name="taux_germination")
  private BigDecimal tauxGermination;
  @Column(name="purete_physique")
  private BigDecimal puretePhysique;
  @Column(name="statut_lot")
  private String statutLot;
  @Column(name="created_at")
  private Instant createdAt;
}
