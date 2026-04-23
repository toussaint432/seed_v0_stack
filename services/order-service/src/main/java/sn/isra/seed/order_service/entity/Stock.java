package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "stock")
@Getter @Setter @NoArgsConstructor
public class Stock {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_lot")
    private Long idLot;

    @Column(name = "id_site")
    private Long idSite;

    @Column(name = "quantite_disponible")
    private BigDecimal quantiteDisponible;

    private String unite;
}
