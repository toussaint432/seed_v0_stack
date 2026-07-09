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
     *
     * LEFT JOIN : inclut les lots dont id_org_producteur est NULL
     * (créés avant correction du bug d'assignation d'org) afin d'éviter
     * un faux 0 qui bloquerait toute commande. Seuls G1-G3 transitent ici.
     */
    @Query(value = """
        SELECT COALESCE(SUM(l.quantite_nette), 0)
        FROM lot_semencier l
        LEFT JOIN organisation o ON l.id_org_producteur = o.id
        WHERE l.id_variete = :idVariete
          AND l.id_generation = :idGeneration
          AND l.statut_lot IN ('DISPONIBLE','CERTIFIE','EN_COURS_CERT')
          AND (o.type_organisation = 'UPSEMCL' OR l.id_org_producteur IS NULL)
        """, nativeQuery = true)
    BigDecimal sumDisponibleUpsemcl(@Param("idVariete") Long idVariete,
                                    @Param("idGeneration") Long idGeneration);

    /**
     * Débite le lot UPSemCL ayant le plus grand stock pour la variété+génération.
     * Sélectionne le premier lot DISPONIBLE ou CERTIFIE par quantité DESC.
     */
    /**
     * Débite le lot UPSemCL (ou sans org) ayant le plus grand stock
     * pour la variété+génération. Même logique LEFT JOIN que sumDisponibleUpsemcl.
     */
    @Modifying
    @Query(value = """
        UPDATE lot_semencier
           SET quantite_nette = quantite_nette - :qte
         WHERE id = (
               SELECT l.id
                 FROM lot_semencier l
                 LEFT JOIN organisation o ON l.id_org_producteur = o.id
                WHERE l.id_variete  = :idVariete
                  AND l.id_generation = :idGeneration
                  AND l.statut_lot IN ('DISPONIBLE','CERTIFIE')
                  AND (o.type_organisation = 'UPSEMCL' OR l.id_org_producteur IS NULL)
                ORDER BY l.quantite_nette DESC
                LIMIT 1
         )
        """, nativeQuery = true)
    int debitLotUpsemcl(@Param("idVariete") Long idVariete,
                        @Param("idGeneration") Long idGeneration,
                        @Param("qte") BigDecimal qte);

    /**
     * Débite la quantité_nette d'un lot précis identifié par son ID.
     * Utilisé lors d'une livraison directe (valider-et-livrer) où l'agent UPSemCL
     * a sélectionné manuellement le lot source à transférer.
     *
     * La clause AND quantite_nette >= :qte protège contre le passage sous zéro :
     * si le retour vaut 0, c'est qu'il n'y avait plus assez → l'appelant lance une erreur.
     */
    @Modifying
    @Query(value = """
        UPDATE lot_semencier
           SET quantite_nette = quantite_nette - :qte
         WHERE id = :idLot
           AND quantite_nette >= :qte
        """, nativeQuery = true)
    int debitLotById(@Param("idLot") Long idLot,
                     @Param("qte") BigDecimal qte);
}
