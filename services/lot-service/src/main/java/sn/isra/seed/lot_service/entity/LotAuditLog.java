package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "lot_audit_log", schema = "lot",
    indexes = { @Index(name = "idx_audit_lot_id", columnList = "lot_id") }
)
@Getter @Setter @NoArgsConstructor
public class LotAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lot_id", nullable = false)
    private Long lotId;

    @Column(nullable = false, length = 150)
    private String username;

    /** MODIFICATION | SUPPRESSION | CONFIRMATION */
    @Column(nullable = false, length = 30)
    private String action;

    /** Nom du champ modifié (null pour actions globales) */
    @Column(length = 100)
    private String champ;

    @Column(name = "ancienne_valeur", columnDefinition = "TEXT")
    private String ancienneValeur;

    @Column(name = "nouvelle_valeur", columnDefinition = "TEXT")
    private String nouvelleValeur;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public static LotAuditLog modification(Long lotId, String username,
                                            String champ, String ancien, String nouveau) {
        LotAuditLog e = new LotAuditLog();
        e.lotId = lotId; e.username = username;
        e.action = "MODIFICATION"; e.champ = champ;
        e.ancienneValeur = ancien; e.nouvelleValeur = nouveau;
        return e;
    }

    public static LotAuditLog confirmation(Long lotId, String username) {
        LotAuditLog e = new LotAuditLog();
        e.lotId = lotId; e.username = username;
        e.action = "CONFIRMATION";
        return e;
    }

    public static LotAuditLog suppression(Long lotId, String username) {
        LotAuditLog e = new LotAuditLog();
        e.lotId = lotId; e.username = username;
        e.action = "SUPPRESSION";
        return e;
    }
}
