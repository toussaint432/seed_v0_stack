package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "facture_ligne", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class FactureLigne {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonBackReference
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_facture", nullable = false)
    private Facture facture;

    @Column(name = "id_lot")
    private Long idLot;

    @Column(name = "code_lot", length = 80)
    private String codeLot;

    @Column(name = "nom_variete", length = 200)
    private String nomVariete;

    @Column(name = "code_variete", length = 50)
    private String codeVariete;

    @Column(name = "generation", length = 10)
    private String generation;

    @Column(name = "campagne", length = 20)
    private String campagne;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal quantite;

    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @Column(name = "prix_unitaire_ht", nullable = false, precision = 12, scale = 2)
    private BigDecimal prixUnitaireHt;

    @Column(name = "taux_tva", nullable = false, precision = 5, scale = 2)
    private BigDecimal tauxTva = BigDecimal.ZERO;

    @Column(name = "montant_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantHt;

    @Column(name = "montant_ttc", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTtc;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (montantHt == null && prixUnitaireHt != null && quantite != null)
            montantHt = prixUnitaireHt.multiply(quantite);
        if (montantTtc == null && montantHt != null && tauxTva != null)
            montantTtc = montantHt.multiply(BigDecimal.ONE.add(tauxTva.divide(new java.math.BigDecimal("100"))));
    }
}
