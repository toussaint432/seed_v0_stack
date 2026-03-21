package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="allocation_commande")
@Getter @Setter @NoArgsConstructor
public class AllocationCommande {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_ligne")
  private LigneCommande ligne;

  @Column(name="id_lot", nullable=false)
  private Long idLot;

  @Column(name="quantite_allouee", nullable=false)
  private BigDecimal quantiteAllouee;

  @Column(name="created_at")
  private Instant createdAt;
}
