package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "bordereau", schema = "orders",
    indexes = {
        @Index(name = "idx_bordereau_commande",         columnList = "id_commande"),
        @Index(name = "idx_bordereau_org_emetteur",     columnList = "id_org_emetteur"),
        @Index(name = "idx_bordereau_org_destinataire", columnList = "id_org_destinataire")
    }
)
@Getter @Setter @NoArgsConstructor
public class Bordereau {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "type_bordereau", nullable = false, length = 30)
    private String typeBordereau;

    @Column(name = "numero_bordereau", nullable = false, unique = true, length = 50)
    private String numeroBordereau;

    @Column(name = "id_commande")
    private Long idCommande;

    @Column(name = "id_transfert_lot")
    private Long idTransfertLot;

    @Column(name = "date_emission", updatable = false)
    private Instant dateEmission;

    @Column(name = "username_emetteur", nullable = false, length = 150)
    private String usernameEmetteur;

    @Column(name = "id_org_emetteur", nullable = false)
    private Long idOrgEmetteur;

    @Column(name = "id_org_destinataire", nullable = false)
    private Long idOrgDestinataire;

    @PrePersist
    void prePersist() {
        if (dateEmission == null) dateEmission = Instant.now();
    }
}
