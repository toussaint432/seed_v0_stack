package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ConversationRepo extends JpaRepository<Conversation, Long> {

    @Query("SELECT c FROM Conversation c WHERE c.participant1 = :u OR c.participant2 = :u ORDER BY c.dernierMessageAt DESC")
    List<Conversation> findByParticipant(@Param("u") String username);

    @Query("SELECT c FROM Conversation c WHERE (c.participant1 = :p1 AND c.participant2 = :p2) OR (c.participant1 = :p2 AND c.participant2 = :p1)")
    Optional<Conversation> findByParticipants(@Param("p1") String p1, @Param("p2") String p2);
}
