package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

/**
 * Repo order-service pour créer automatiquement un transfert_lot
 * lors du passage d'une commande au statut LIVREE.
 * Partagé via la même base PostgreSQL.
 */
public interface TransfertLotOrderRepo extends org.springframework.data.repository.Repository<Object, Long> {

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
}
