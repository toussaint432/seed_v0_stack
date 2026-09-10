package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "accuse_reception_facture", schema = "orders")
@Getter @Setter @NoArgsConstructor
public class AccuseReceptionFacture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_facture", nullable = false, unique = true)
    private Facture facture;

    @Column(name = "date_accusee", nullable = false)
    private Instant dateAccusee;

    @Column(name = "username_acheteur", nullable = false, length = 150)
    private String usernameAcheteur;

    /** RECU | CONTESTE */
    @Column(nullable = false, length = 20)
    private String statut = "RECU";

    @Column(columnDefinition = "TEXT")
    private String observations;

    @PrePersist
    void prePersist() {
        if (dateAccusee == null) dateAccusee = Instant.now();
    }
}
