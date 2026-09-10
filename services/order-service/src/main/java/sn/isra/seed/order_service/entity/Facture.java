package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import sn.isra.seed.order_service.entity.enums.StatutFacture;
import sn.isra.seed.order_service.entity.enums.TypeFacture;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "facture", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class Facture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_commande", nullable = false)
    private Commande commande;

    @Column(name = "numero_facture", unique = true, nullable = false, length = 60)
    private String numeroFacture;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_facture", nullable = false, length = 30)
    private TypeFacture typeFacture = TypeFacture.MULTIPLICATEUR;

    @Column(name = "date_emission", nullable = false)
    private Instant dateEmission;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutFacture statut = StatutFacture.EMISE;

    @Column(name = "montant_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantHt = BigDecimal.ZERO;

    @Column(name = "montant_tva", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTva = BigDecimal.ZERO;

    @Column(name = "montant_ttc", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTtc = BigDecimal.ZERO;

    @Column(name = "username_emetteur", length = 150)
    private String usernameEmetteur;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @JsonManagedReference
    @OneToMany(mappedBy = "facture", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<FactureLigne> lignes = new ArrayList<>();

    @OneToOne(mappedBy = "facture", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private AccuseReceptionFacture accuseReception;

    @PrePersist
    void prePersist() {
        if (createdAt  == null) createdAt  = Instant.now();
        if (updatedAt  == null) updatedAt  = Instant.now();
        if (dateEmission == null) dateEmission = Instant.now();
    }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
