package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sn.isra.seed.order_service.entity.TransfertLot;

import java.math.BigDecimal;

/**
 * Repo order-service pour créer automatiquement un transfert_lot
 * lors du passage d'une commande au statut LIVREE.
 * Partagé via la même base PostgreSQL (pattern base partagée).
 */
public interface TransfertLotOrderRepo extends JpaRepository<TransfertLot, Long> {

    @Modifying
    @Query(value = """
        INSERT INTO transfert_lot
          (code_transfert, id_lot, username_emetteur, role_emetteur,
           username_destinataire, role_destinataire, generation_transferee,
           quantite, statut, date_demande, date_acceptation, created_at)
        SELECT
          :code, :idLot, :emetteur, 'seed-upsemcl',
          :destinataire, 'seed-multiplicator',
          g.code_generation,
          :quantite, 'ACCEPTE', CURRENT_DATE, CURRENT_DATE, now()
        FROM lot_semencier l
        JOIN generation_semence g ON l.id_generation = g.id
        WHERE l.id = :idLot
        """, nativeQuery = true)
    int createAutoTransfert(@Param("code") String code,
                            @Param("idLot") Long idLot,
                            @Param("emetteur") String emetteur,
                            @Param("destinataire") String destinataire,
                            @Param("quantite") BigDecimal quantite);

    /** Crée un transfert en attente de validation par le multiplicateur (statut EN_ATTENTE). */
    @Modifying
    @Query(value = """
        INSERT INTO transfert_lot
          (code_transfert, id_lot, username_emetteur, role_emetteur,
           username_destinataire, role_destinataire, generation_transferee,
           quantite, statut, date_demande, created_at)
        SELECT
          :code, :idLot, :emetteur, 'seed-upsemcl',
          :destinataire, 'seed-multiplicator',
          g.code_generation,
          :quantite, 'EN_ATTENTE', CURRENT_DATE, now()
        FROM lot_semencier l
        JOIN generation_semence g ON l.id_generation = g.id
        WHERE l.id = :idLot
        """, nativeQuery = true)
    int createPendingTransfert(@Param("code") String code,
                               @Param("idLot") Long idLot,
                               @Param("emetteur") String emetteur,
                               @Param("destinataire") String destinataire,
                               @Param("quantite") BigDecimal quantite);

    /** Accepte un transfert en attente : statut → ACCEPTE + date_acceptation = aujourd'hui. */
    @Modifying
    @Query(value = """
        UPDATE transfert_lot
        SET statut = 'ACCEPTE', date_acceptation = CURRENT_DATE
        WHERE code_transfert = :code
        """, nativeQuery = true)
    int accepterTransfert(@Param("code") String code);
}
