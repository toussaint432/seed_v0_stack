package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_audit_log", schema = "orders",
    indexes = {
        @Index(name = "idx_audit_username",   columnList = "username"),
        @Index(name = "idx_audit_created_at", columnList = "created_at"),
    })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String username;

    @Column(name = "action_type", nullable = false, length = 60)
    private String actionType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "entity_ref", length = 100)
    private String entityRef;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
