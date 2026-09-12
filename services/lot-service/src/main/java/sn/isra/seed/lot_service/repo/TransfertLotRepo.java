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

    /**
     * Visibilité organisation : tous les transferts où le rôle émetteur OU destinataire
     * correspond au rôle donné. Utilisé pour UPSemCL (seed-upsemcl) afin de voir
     * tous les transferts de l'organisation, pas seulement ceux liés à un username.
     */
    @Query("SELECT t FROM TransfertLot t WHERE (t.roleEmetteur = :role OR t.roleDestinataire = :role) ORDER BY t.createdAt DESC")
    List<TransfertLot> findByRoleParticipant(@Param("role") String role);

    /**
     * Transferts EN_ATTENTE destinés à un rôle organisationnel.
     * Permet à tout agent UPSemCL d'accepter/refuser les demandes de son organisation.
     */
    @Query("SELECT t FROM TransfertLot t WHERE t.roleDestinataire = :role AND t.statut = 'EN_ATTENTE' ORDER BY t.createdAt DESC")
    List<TransfertLot> findPendingForRole(@Param("role") String role);

    @Query("SELECT COUNT(t) FROM TransfertLot t WHERE t.usernameDestinataire = :username AND t.statut = sn.isra.seed.lot_service.entity.enums.StatutTransfert.EN_ATTENTE")
    long countPendingForDestinataire(@Param("username") String username);

    @Query("SELECT COUNT(t) FROM TransfertLot t WHERE t.roleDestinataire = :role AND t.statut = sn.isra.seed.lot_service.entity.enums.StatutTransfert.EN_ATTENTE")
    long countPendingForRole(@Param("role") String role);

    /** Filtrage sécurisé "Semences reçues" — idOrg extrait du JWT, jamais du client */
    @Query("SELECT t FROM TransfertLot t WHERE t.idOrgDestinataire = :orgId AND t.statut = 'EN_ATTENTE' ORDER BY t.createdAt DESC")
    List<TransfertLot> findPendingForOrgDestinataire(@Param("orgId") Long orgId);

    List<TransfertLot> findByIdOrgDestinataireOrderByCreatedAtDesc(Long idOrgDestinataire);

    List<TransfertLot> findByIdOrgEmetteurOrderByCreatedAtDesc(Long idOrgEmetteur);
}
