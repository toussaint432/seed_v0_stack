package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "reception_commande", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class ReceptionCommande {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_commande", nullable = false, unique = true)
    private Commande commande;

    @Column(name = "username_recepteur", length = 150)
    private String usernameRecepteur;

    @Column(name = "date_reception")
    private Instant dateReception;

    @Column(name = "statut_reception", length = 20)
    private String statutReception = "COMPLET";

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "receptionCommande", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<ReceptionEcart> ecarts = new ArrayList<>();
}
