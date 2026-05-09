package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Vue légère de lot_semencier dans le contexte order-service.
 * Utilisée pour les requêtes natives de vérification et débit de quantité.
 * Partagé via la même base PostgreSQL (pattern base partagée).
 */
@Entity
@Table(name = "lot_semencier")
@Getter @Setter @NoArgsConstructor
public class LotSemencierOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_variete")
    private Long idVariete;

    @Column(name = "id_generation")
    private Long idGeneration;

    @Column(name = "quantite_nette", precision = 14, scale = 2)
    private BigDecimal quantiteNette;

    @Column(name = "statut_lot", length = 30)
    private String statutLot;

    @Column(name = "id_org_producteur")
    private Long idOrgProducteur;
}
