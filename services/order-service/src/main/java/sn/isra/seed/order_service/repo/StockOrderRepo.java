package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;

public interface StockOrderRepo extends JpaRepository<Stock, Long> {

    /**
     * Somme des stocks disponibles toutes organisations confondues pour une variété/génération.
     * Utilisé pour valider les commandes R1/R2 (quotataire) dont les lots appartiennent
     * aux multiplicateurs mais peuvent être détenus sur n'importe quel site.
     */
    @Query(value = """
        SELECT COALESCE(SUM(s.quantite_disponible), 0)
        FROM stock s
        JOIN lot_semencier l ON s.id_lot = l.id
        WHERE l.id_variete    = :idVariete
          AND l.id_generation = :idGeneration
          AND s.quantite_disponible > 0
          AND l.statut_lot IN ('DISPONIBLE','CERTIFIE','EN_COURS_CERT')
          AND l.statut_certification = 'CERTIFIE'
        """, nativeQuery = true)
    BigDecimal sumDisponibleR1R2(@Param("idVariete") Long idVariete,
                                 @Param("idGeneration") Long idGeneration);

    /** Débite le stock du site UPSemCL pour un lot donné. */
    @Modifying
    @Query(value = """
        UPDATE stock
           SET quantite_disponible = quantite_disponible - :qte
         WHERE id_lot = :idLot
           AND quantite_disponible >= :qte
           AND id_site IN (
               SELECT s.id FROM site s
               JOIN organisation o ON s.id_organisation = o.id
               WHERE o.type_organisation = 'UPSEMCL'
           )
        """, nativeQuery = true)
    int debitUpsemcl(@Param("idLot") Long idLot, @Param("qte") BigDecimal qte);

    /**
     * Débite le stock d'une organisation précise pour un lot donné.
     * Utilisé lors du faire-transfert multiplicateur → quotataire
     * (le fournisseur est un multiplicateur, pas l'UPSemCL).
     */
    @Modifying
    @Query(value = """
        UPDATE stock
           SET quantite_disponible = quantite_disponible - :qte
         WHERE id_lot = :idLot
           AND quantite_disponible >= :qte
           AND id_site IN (
               SELECT s.id FROM site s
               WHERE s.id_organisation = :idOrg
           )
        """, nativeQuery = true)
    int debitByOrg(@Param("idLot") Long idLot,
                   @Param("idOrg") Long idOrg,
                   @Param("qte") BigDecimal qte);

    /**
     * Crédite le stock du site PRINCIPAL de l'organisation destinataire pour un lot donné.
     * INSERT ou UPDATE atomique via ON CONFLICT.
     * Utilise ORDER BY est_principal DESC, id ASC pour toujours cibler le site principal.
     */
    @Modifying
    @Query(value = """
        INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
        SELECT :idLot, s.id, :qte, :unite
          FROM site s
         WHERE s.id_organisation = :idOrg
         ORDER BY s.est_principal DESC, s.id ASC
         LIMIT 1
        ON CONFLICT (id_lot, id_site) DO UPDATE
           SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible
        """, nativeQuery = true)
    int creditOrg(@Param("idLot") Long idLot,
                  @Param("idOrg") Long idOrg,
                  @Param("qte") BigDecimal qte,
                  @Param("unite") String unite);

    /**
     * Crédite le stock d'un site explicitement identifié par son code_site.
     * Utilisé quand le multiplicateur a choisi son site de réception.
     */
    @Modifying
    @Query(value = """
        INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
        VALUES (:idLot,
                (SELECT id FROM site WHERE code_site = :codeSite LIMIT 1),
                :qte, :unite)
        ON CONFLICT (id_lot, id_site) DO UPDATE
           SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible
        """, nativeQuery = true)
    int creditSiteCode(@Param("idLot") Long idLot,
                       @Param("codeSite") String codeSite,
                       @Param("qte") BigDecimal qte,
                       @Param("unite") String unite);
}
