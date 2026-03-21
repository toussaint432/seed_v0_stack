package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name="ligne_commande")
@Getter @Setter @NoArgsConstructor
public class LigneCommande {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_commande")
  private Commande commande;

  @Column(name="id_variete", nullable=false)
  private Long idVariete;

  @Column(name="id_generation")
  private Long idGeneration;

  @Column(name="quantite_demandee", nullable=false)
  private BigDecimal quantiteDemandee;

  private String unite;
}
