package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="stock",
  uniqueConstraints = @UniqueConstraint(columnNames = {"id_lot","id_site"})
)
@Getter @Setter @NoArgsConstructor
public class Stock {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="id_lot", nullable=false)
  private Long idLot;

  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_site")
  private Site site;

  @Column(name="quantite_disponible", nullable=false)
  private BigDecimal quantiteDisponible;

  private String unite;

  @Column(name="updated_at")
  private Instant updatedAt;
}
