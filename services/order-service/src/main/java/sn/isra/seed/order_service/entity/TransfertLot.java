package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Vue légère de transfert_lot dans le contexte order-service.
 * Utilisée uniquement pour l'insertion automatique d'un transfert
 * lors du passage d'une commande au statut LIVREE.
 * Partagé via la même base PostgreSQL (pattern base partagée).
 */
@Entity
@Table(name = "transfert_lot", schema = "lot")
@Getter @Setter @NoArgsConstructor
public class TransfertLot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_transfert", length = 80, nullable = false, unique = true)
    private String codeTransfert;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(name = "username_emetteur", length = 150, nullable = false)
    private String usernameEmetteur;

    @Column(name = "role_emetteur", length = 50, nullable = false)
    private String roleEmetteur;

    @Column(name = "username_destinataire", length = 150, nullable = false)
    private String usernameDestinataire;

    @Column(name = "role_destinataire", length = 50, nullable = false)
    private String roleDestinataire;

    @Column(name = "generation_transferee", length = 10, nullable = false)
    private String generationTransferee;

    @Column(name = "quantite", precision = 12, scale = 2)
    private BigDecimal quantite;

    @Column(name = "statut", length = 30, nullable = false)
    private String statut;

    @Column(name = "date_demande")
    private LocalDate dateDemande;

    @Column(name = "date_acceptation")
    private LocalDate dateAcceptation;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
