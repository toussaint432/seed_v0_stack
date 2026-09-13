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
          :code, :idLot, :emetteur, :roleEmetteur,
          :destinataire, :roleDestinataire,
          g.code_generation,
          :quantite, 'ACCEPTE', CURRENT_DATE, CURRENT_DATE, now()
        FROM lot_semencier l
        JOIN generation_semence g ON l.id_generation = g.id
        WHERE l.id = :idLot
        """, nativeQuery = true)
    int createAutoTransfert(@Param("code") String code,
                            @Param("idLot") Long idLot,
                            @Param("emetteur") String emetteur,
                            @Param("roleEmetteur") String roleEmetteur,
                            @Param("destinataire") String destinataire,
                            @Param("roleDestinataire") String roleDestinataire,
                            @Param("quantite") BigDecimal quantite);

    /** Crée un transfert en attente de validation par le destinataire (statut EN_ATTENTE). */
    @Modifying
    @Query(value = """
        INSERT INTO transfert_lot
          (code_transfert, id_lot, username_emetteur, role_emetteur,
           username_destinataire, role_destinataire, generation_transferee,
           quantite, statut, date_demande, created_at)
        SELECT
          :code, :idLot, :emetteur, :roleEmetteur,
          :destinataire, :roleDestinataire,
          g.code_generation,
          :quantite, 'EN_ATTENTE', CURRENT_DATE, now()
        FROM lot_semencier l
        JOIN generation_semence g ON l.id_generation = g.id
        WHERE l.id = :idLot
        """, nativeQuery = true)
    int createPendingTransfert(@Param("code") String code,
                               @Param("idLot") Long idLot,
                               @Param("emetteur") String emetteur,
                               @Param("roleEmetteur") String roleEmetteur,
                               @Param("destinataire") String destinataire,
                               @Param("roleDestinataire") String roleDestinataire,
                               @Param("quantite") BigDecimal quantite);

    /**
     * Accepte un ou plusieurs transferts EN_ATTENTE liés à une commande.
     * Supporte les deux formats de code :
     *   - ancien (mono-ligne) : code exact   → WHERE code_transfert = 'TL-XXX'
     *   - nouveau (multi-lignes) : préfixe   → WHERE code_transfert LIKE 'TL-XXX-%'
     */
    @Modifying
    @Query(value = """
        UPDATE transfert_lot
        SET statut = 'ACCEPTE', date_acceptation = CURRENT_DATE
        WHERE code_transfert = :code
           OR code_transfert LIKE :code || '-%'
        """, nativeQuery = true)
    int accepterTransfert(@Param("code") String code);

    /**
     * Trace une transition dans lot.transfert_lot_event pour un transfert créé atomiquement.
     * Appelé juste après createAutoTransfert pour alimenter le journal immuable (V83).
     */
    @Modifying
    @Query(value = """
        INSERT INTO lot.transfert_lot_event
            (id_transfert_lot, statut_avant, statut_apres, username, commentaire, created_at)
        SELECT t.id, NULL, t.statut, :username, :commentaire, now()
        FROM lot.transfert_lot t
        WHERE t.code_transfert = :code
        LIMIT 1
        """, nativeQuery = true)
    void insertEventAcceptation(@Param("code") String code,
                                @Param("username") String username,
                                @Param("commentaire") String commentaire);

    /**
     * Redirige un transfert EN_ATTENTE vers le lot de réception (REC) créé pour le multiplicateur.
     * Supporte les deux formats de code (exact ou préfixe avec suffixe -L{id}).
     */
    @Modifying
    @Query(value = """
        UPDATE transfert_lot
        SET id_lot = :newLotId
        WHERE (code_transfert = :code OR code_transfert LIKE :code || '-%')
          AND id_lot = :oldLotId
        """, nativeQuery = true)
    int updateTransfertIdLot(@Param("code")      String code,
                              @Param("oldLotId") Long   oldLotId,
                              @Param("newLotId") Long   newLotId);
}
