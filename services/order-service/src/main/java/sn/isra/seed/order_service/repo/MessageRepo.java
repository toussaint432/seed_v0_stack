package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface MessageRepo extends JpaRepository<Message, Long> {

    List<Message> findByIdConversationOrderByCreatedAtAsc(Long idConversation);

    @Query("SELECT m FROM Message m WHERE m.idConversation = :id ORDER BY m.createdAt DESC")
    List<Message> findRecentByConversation(@Param("id") Long id, Pageable pageable);

    long countByIdConversationAndLuFalseAndExpediteurNot(Long idConversation, String expediteur);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.lu = false AND m.expediteur <> :username AND m.idConversation IN (SELECT c.id FROM Conversation c WHERE c.participant1 = :username OR c.participant2 = :username)")
    Long countTotalUnread(@Param("username") String username);

    @Modifying
    @Query("UPDATE Message m SET m.lu = true WHERE m.idConversation = :convId AND m.expediteur <> :username AND m.lu = false")
    void markAsRead(@Param("convId") Long convId, @Param("username") String username);
}
