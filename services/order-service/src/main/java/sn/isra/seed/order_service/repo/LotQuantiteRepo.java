package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.LotSemencierOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface LotQuantiteRepo extends JpaRepository<LotSemencierOrder, Long> {

    /**
     * Somme de la quantité nette disponible dans les lots UPSemCL
     * pour une variété + génération donnée (statuts vendables).
     */
    @Query(value = """
        SELECT COALESCE(SUM(l.quantite_nette), 0)
        FROM lot_semencier l
        JOIN organisation o ON l.id_org_producteur = o.id
        WHERE l.id_variete = :idVariete
          AND l.id_generation = :idGeneration
          AND l.statut_lot IN ('DISPONIBLE','CERTIFIE','EN_COURS_CERT')
          AND o.type_organisation = 'UPSEMCL'
        """, nativeQuery = true)
    BigDecimal sumDisponibleUpsemcl(@Param("idVariete") Long idVariete,
                                    @Param("idGeneration") Long idGeneration);

    /**
     * Débite le lot UPSemCL ayant le plus grand stock pour la variété+génération.
     * Sélectionne le premier lot DISPONIBLE ou CERTIFIE par quantité DESC.
     */
    @Modifying
    @Query(value = """
        UPDATE lot_semencier
           SET quantite_nette = quantite_nette - :qte
         WHERE id = (
               SELECT l.id
                 FROM lot_semencier l
                 JOIN organisation o ON l.id_org_producteur = o.id
                WHERE l.id_variete  = :idVariete
                  AND l.id_generation = :idGeneration
                  AND l.statut_lot IN ('DISPONIBLE','CERTIFIE')
                  AND o.type_organisation = 'UPSEMCL'
                ORDER BY l.quantite_nette DESC
                LIMIT 1
         )
        """, nativeQuery = true)
    int debitLotUpsemcl(@Param("idVariete") Long idVariete,
                        @Param("idGeneration") Long idGeneration,
                        @Param("qte") BigDecimal qte);
}
