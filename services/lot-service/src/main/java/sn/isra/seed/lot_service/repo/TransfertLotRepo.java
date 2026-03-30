package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.TransfertLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TransfertLotRepo extends JpaRepository<TransfertLot, Long> {

    List<TransfertLot> findByUsernameEmetteurOrderByCreatedAtDesc(String username);

    List<TransfertLot> findByUsernameDestinataireOrderByCreatedAtDesc(String username);

    @Query("SELECT t FROM TransfertLot t WHERE t.usernameDestinataire = :username AND t.statut = 'EN_ATTENTE' ORDER BY t.createdAt DESC")
    List<TransfertLot> findPendingForDestinataire(@Param("username") String username);

    @Query("SELECT t FROM TransfertLot t WHERE (t.usernameEmetteur = :username OR t.usernameDestinataire = :username) ORDER BY t.createdAt DESC")
    List<TransfertLot> findByParticipant(@Param("username") String username);
}
