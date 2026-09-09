package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;
import sn.isra.seed.order_service.entity.enums.StatutLigne;

import java.math.BigDecimal;

@Entity
@Table(name = "ligne_commande", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class LigneCommande {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @JsonBackReference
  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_commande")
  private Commande commande;

  @Column(name="id_variete", nullable=false)
  private Long idVariete;

  @Column(name="id_generation", insertable=false, updatable=false)
  private Long idGeneration;

  @ManyToOne(fetch=FetchType.EAGER)
  @JoinColumn(name="id_generation")
  private GenerationSemence generation;

  @Column(name="quantite_demandee", nullable=false)
  private BigDecimal quantiteDemandee;

  private String unite;

  @Column(name="quantite_proposee")
  private BigDecimal quantiteProposee;

  @Column(name="id_lot_propose")
  private Long idLotPropose;

  @Enumerated(EnumType.STRING)
  @Column(name = "statut_ligne", length = 20)
  private StatutLigne statutLigne = StatutLigne.SOUMISE;
}
