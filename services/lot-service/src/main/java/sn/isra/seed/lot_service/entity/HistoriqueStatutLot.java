package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutLot;

import java.time.Instant;

/**
 * Audit trail des changements de statut d'un lot semencier.
 * Chaque transition DISPONIBLE → CERTIFIE, CERTIFIE → TRANSFERE, etc.
 * est enregistrée ici avec l'acteur responsable.
 */
@Entity
@Table(name = "historique_statut_lot",
    indexes = {
        @Index(name = "idx_hist_lot",  columnList = "id_lot"),
        @Index(name = "idx_hist_date", columnList = "created_at")
    }
)
@Getter @Setter @NoArgsConstructor
public class HistoriqueStatutLot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Enumerated(EnumType.STRING)
    @Column(name = "ancien_statut", length = 30)
    private StatutLot ancienStatut;

    @NotNull(message = "Le nouveau statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "nouveau_statut", nullable = false, length = 30)
    private StatutLot nouveauStatut;

    /** Identifiant Keycloak de l'acteur ayant effectué le changement */
    @Size(max = 150)
    @Column(length = 150)
    private String username;

    @Column(columnDefinition = "TEXT")
    private String commentaire;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    /** Factory method pour créer une entrée d'historique proprement */
    public static HistoriqueStatutLot of(Long idLot, StatutLot ancien,
                                          StatutLot nouveau, String username,
                                          String commentaire) {
        var h = new HistoriqueStatutLot();
        h.idLot         = idLot;
        h.ancienStatut  = ancien;
        h.nouveauStatut = nouveau;
        h.username      = username;
        h.commentaire   = commentaire;
        return h;
    }
}
