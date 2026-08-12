package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Entité du Transactional Outbox Pattern.
 * Chaque mise à jour de stock critique (transfert accepté, mouvement) génère
 * une ligne dans cette table dans la MÊME transaction que la mise à jour
 * du stock. L'OutboxRelay publie ensuite vers Kafka de façon asynchrone.
 * Garantit qu'aucun événement n'est perdu même si Kafka est temporairement
 * indisponible.
 */
@Entity
@Table(name = "outbox_events", schema = "stock",
    indexes = @Index(name = "idx_outbox_unprocessed", columnList = "created_at")
)
@Getter @Setter @NoArgsConstructor
public class OutboxEvent {

    @Id
    @Column(columnDefinition = "UUID", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "aggregate_type", nullable = false, length = 100)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, length = 100)
    private String aggregateId;

    @Column(nullable = false, length = 100)
    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB", nullable = false)
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Boolean processed = false;

    @PrePersist
    void prePersist() {
        if (id == null)        id        = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (processed == null) processed = false;
    }
}
