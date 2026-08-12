package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "conversation", schema = "shared")
@Getter @Setter @NoArgsConstructor
public class Conversation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "participant_1", nullable = false, length = 150)
    private String participant1;

    @Column(name = "participant_2", nullable = false, length = 150)
    private String participant2;

    @Column(name = "dernier_message_at")
    private Instant dernierMessageAt = Instant.now();

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (dernierMessageAt == null) dernierMessageAt = Instant.now();
    }
}
