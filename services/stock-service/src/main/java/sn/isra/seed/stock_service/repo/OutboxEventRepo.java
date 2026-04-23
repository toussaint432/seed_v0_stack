package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepo extends JpaRepository<OutboxEvent, UUID> {

    /** Récupère le prochain lot d'événements non publiés (max 50, FIFO). */
    List<OutboxEvent> findTop50ByProcessedFalseOrderByCreatedAtAsc();

    /** Marquage atomique en base — appelé APRÈS confirmation de Kafka. */
    @Modifying
    @Query("UPDATE OutboxEvent e SET e.processed = TRUE WHERE e.id = :id")
    void markProcessed(@Param("id") UUID id);
}
