package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="mouvement_stock")
@Getter @Setter @NoArgsConstructor
public class MouvementStock {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="id_lot", nullable=false)
  private Long idLot;

  @Column(name="type_mouvement", nullable=false)
  private String typeMouvement; // IN, OUT, TRANSFER

  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="id_site_source")
  private Site siteSource;

  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="id_site_destination")
  private Site siteDestination;

  @Column(nullable=false)
  private BigDecimal quantite;

  private String unite;

  @Column(name="reference_operation")
  private String referenceOperation;

  @Column(name="created_at")
  private Instant createdAt;
}
