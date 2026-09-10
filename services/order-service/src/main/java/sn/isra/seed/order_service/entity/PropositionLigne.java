package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "proposition_ligne", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class PropositionLigne {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_ligne_commande", nullable = false, unique = true)
    private LigneCommande ligneCommande;

    @Column(name = "id_lot_suggere_fifo")
    private Long idLotSuggereFifo;

    @Column(name = "quantite_suggere", precision = 14, scale = 2)
    private BigDecimal quantiteSuggere;

    @Column(name = "id_lot_selectionne", nullable = false)
    private Long idLotSelectionne;

    @Column(name = "quantite_selectionnee", nullable = false, precision = 14, scale = 2)
    private BigDecimal quantiteSelectionnee;

    @Column(name = "motif_override", columnDefinition = "TEXT")
    private String motifOverride;

    @Column(name = "username_agent", length = 150)
    private String usernameAgent;

    @Column(name = "statut_proposition", length = 20)
    private String statutProposition = "PROPOSEE";

    /** Prix unitaire HT en FCFA/kg — saisi par le vendeur lors de la proposition */
    @Column(name = "prix_unitaire_ht", precision = 12, scale = 2)
    private java.math.BigDecimal prixUnitaireHt;

    /** Taux de TVA en % (0 pour les semences certifiées subventionnées) */
    @Column(name = "taux_tva", precision = 5, scale = 2)
    private java.math.BigDecimal tauxTva = java.math.BigDecimal.ZERO;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "propositionLigne", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<PropositionLotSource> sources = new ArrayList<>();
}
