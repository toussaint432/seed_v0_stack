package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "reception_ecart", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class ReceptionEcart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonBackReference
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reception_commande", nullable = false)
    private ReceptionCommande receptionCommande;

    @Column(name = "id_lot_source", nullable = false)
    private Long idLotSource;

    @Column(name = "quantite_transferee", nullable = false, precision = 14, scale = 2)
    private BigDecimal quantiteTransferee;

    @Column(name = "quantite_recue", nullable = false, precision = 14, scale = 2)
    private BigDecimal quantiteRecue;

    @Column(columnDefinition = "TEXT")
    private String observations;
}
