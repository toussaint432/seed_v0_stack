package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "proposition_lot_source", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class PropositionLotSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonBackReference
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_proposition_ligne", nullable = false)
    private PropositionLigne propositionLigne;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal quantite;

    @Column(name = "fifo_suggere", nullable = false)
    private boolean fifoSuggere = true;

    @Column(name = "ordre_priorite", nullable = false)
    private int ordrePriorite = 1;
}
