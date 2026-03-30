package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversation")
@Getter @Setter @NoArgsConstructor
public class Conversation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "participant_1", nullable = false, length = 150)
    private String participant1;

    @Column(name = "participant_2", nullable = false, length = 150)
    private String participant2;

    @Column(name = "dernier_message_at")
    private LocalDateTime dernierMessageAt = LocalDateTime.now();

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
