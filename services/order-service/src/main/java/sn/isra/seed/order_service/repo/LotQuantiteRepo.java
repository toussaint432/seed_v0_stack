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
    /**
     * Débite le lot par ID et passe son statut à TRANSFERE si la quantité restante atteint zéro.
     * Transfert partiel : si quantite_nette - qte > 0, le statut reste inchangé (DISPONIBLE).
     */
    @Modifying
    @Query(value = """
        UPDATE lot_semencier
           SET quantite_nette = quantite_nette - :qte,
               statut_lot = CASE WHEN (quantite_nette - :qte) <= 0 THEN 'TRANSFERE' ELSE statut_lot END
         WHERE id = :idLot
           AND quantite_nette >= :qte
        """, nativeQuery = true)
    int debitLotById(@Param("idLot") Long idLot,
                     @Param("qte") BigDecimal qte);

    /** Enregistre une entrée d'historique de statut pour un lot (utilisé par order-service). */
    @Modifying
    @Query(value = """
        INSERT INTO historique_statut_lot (id_lot, ancien_statut, nouveau_statut, username, commentaire)
        VALUES (:idLot, :ancienStatut, :nouveauStatut, :username, :commentaire)
        """, nativeQuery = true)
    void insertHistoriqueTransfert(@Param("idLot") Long idLot,
                                   @Param("ancienStatut") String ancienStatut,
                                   @Param("nouveauStatut") String nouveauStatut,
                                   @Param("username") String username,
                                   @Param("commentaire") String commentaire);

    /**
     * Catalogue G3 agrégé par variété — pour les multiplicateurs.
     * Retourne la quantité totale certifiée disponible par variété G3 UPSemCL.
     * Ordre : espèce alphabétique puis variété alphabétique.
     */
    @Query(value = """
        SELECT
            v.id           AS id_variete,
            v.nom_variete,
            v.code_variete,
            e.id           AS id_espece,
            e.nom_commun   AS nom_espece,
            e.code_espece,
            g.id           AS id_generation,
            g.code_generation,
            COALESCE(SUM(l.quantite_nette), 0) AS quantite_totale,
            COUNT(l.id)    AS nb_lots,
            MIN(l.created_at) AS date_plus_ancien_lot
        FROM lot.lot_semencier l
        JOIN lot.generation_semence g   ON l.id_generation  = g.id
        JOIN catalog.variete        v   ON l.id_variete     = v.id
        JOIN catalog.espece         e   ON v.id_espece      = e.id
        LEFT JOIN shared.organisation o ON l.id_org_producteur = o.id
        WHERE g.code_generation = 'G3'
          AND l.statut_lot IN ('DISPONIBLE','CERTIFIE','EN_COURS_CERT')
          AND (o.type_organisation = 'UPSEMCL' OR l.id_org_producteur IS NULL)
        GROUP BY v.id, v.nom_variete, v.code_variete, e.id, e.nom_commun, e.code_espece, g.id, g.code_generation
        HAVING COALESCE(SUM(l.quantite_nette), 0) > 0
        ORDER BY e.nom_commun, v.nom_variete
        """, nativeQuery = true)
    java.util.List<Object[]> findCatalogueG3Agrege();

    /**
     * Lots G3 UPSemCL disponibles pour une variété, ordonnés FIFO (plus ancien en premier).
     * Inclut les métriques qualité du dernier contrôle.
     */
    @Query(value = """
        SELECT
            l.id,
            l.code_lot,
            l.quantite_nette,
            l.campagne,
            l.created_at,
            l.statut_lot,
            cq.purete_physique,
            cq.taux_germination,
            cq.taux_humidite
        FROM lot.lot_semencier l
        LEFT JOIN shared.organisation o ON l.id_org_producteur = o.id
        LEFT JOIN LATERAL (
            SELECT purete_physique, taux_germination, taux_humidite
            FROM lot.controle_qualite
            WHERE id_lot = l.id
            ORDER BY date_controle DESC
            LIMIT 1
        ) cq ON true
        WHERE l.id_variete = :idVariete
          AND l.id_generation = 4
          AND l.statut_lot IN ('DISPONIBLE','CERTIFIE','EN_COURS_CERT')
          AND (o.type_organisation = 'UPSEMCL' OR l.id_org_producteur IS NULL)
        ORDER BY l.created_at ASC
        """, nativeQuery = true)
    java.util.List<Object[]> findLotsG3FifoPourVariete(@Param("idVariete") Long idVariete);
}
