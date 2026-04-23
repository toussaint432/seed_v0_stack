package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;

public interface StockOrderRepo extends JpaRepository<Stock, Long> {

    /** Débite le stock du site UPSemCL pour un lot donné. */
    @Modifying
    @Query(value = """
        UPDATE stock
           SET quantite_disponible = quantite_disponible - :qte
         WHERE id_lot = :idLot
           AND id_site IN (
               SELECT s.id FROM site s
               JOIN organisation o ON s.id_organisation = o.id
               WHERE o.type_organisation = 'UPSEMCL'
           )
        """, nativeQuery = true)
    int debitUpsemcl(@Param("idLot") Long idLot, @Param("qte") BigDecimal qte);

    /**
     * Crédite le stock du site de l'organisation destinataire pour un lot donné.
     * INSERT ou UPDATE atomique via ON CONFLICT.
     */
    @Modifying
    @Query(value = """
        INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
        SELECT :idLot, s.id, :qte, :unite
          FROM site s
         WHERE s.id_organisation = :idOrg
         LIMIT 1
        ON CONFLICT (id_lot, id_site) DO UPDATE
           SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible
        """, nativeQuery = true)
    int creditOrg(@Param("idLot") Long idLot,
                  @Param("idOrg") Long idOrg,
                  @Param("qte") BigDecimal qte,
                  @Param("unite") String unite);
}
