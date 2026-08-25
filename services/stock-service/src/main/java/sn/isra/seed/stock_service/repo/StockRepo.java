package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.api.dto.CatalogueItem;
import sn.isra.seed.stock_service.api.dto.CatalogueProximiteItem;
import sn.isra.seed.stock_service.api.dto.StockAgregeView;
import sn.isra.seed.stock_service.entity.Stock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface StockRepo extends JpaRepository<Stock, Long> {

  List<Stock> findBySite_CodeSite(String codeSite);
  Page<Stock> findBySite_CodeSite(String codeSite, Pageable pageable);
  Optional<Stock> findByIdLotAndSite_CodeSite(Long idLot, String codeSite);

  /**
   * Stocks positifs d'un lot, triés selon la règle FIFO (Premier Entré, Premier Sorti).
   *
   * La règle FIFO garantit que lors d'un débit de stock (sortie ou transfert),
   * on consomme en priorité les semences les plus anciennes (date d'enregistrement
   * la plus ancienne), ce qui préserve la fraîcheur et la qualité des lots récents.
   *
   * @param idLot identifiant du lot semencier concerné
   * @return liste des entrées de stock disponibles, ordonnées par date de création ASC
   */
  @Query("SELECT s FROM Stock s WHERE s.idLot = :idLot AND s.quantiteDisponible > 0 ORDER BY s.createdAt ASC")
  List<Stock> findPositiveByIdLot(@Param("idLot") Long idLot);

  /**
   * Verrou pessimiste sur la ligne stock avant débit.
   * SELECT ... FOR UPDATE bloque les écritures concurrentes sur la même ligne
   * jusqu'à la fin de la transaction — élimine les race conditions.
   */
  @Query(value = """
      SELECT quantite_disponible FROM stock
      WHERE id_lot = :idLot
        AND id_site = (SELECT id FROM site WHERE code_site = :codeSite)
      FOR UPDATE
      """, nativeQuery = true)
  Optional<BigDecimal> lockAndGetQuantite(@Param("idLot") Long idLot,
                                          @Param("codeSite") String codeSite);

  /**
   * Débit atomique : UPDATE natif — pas de read-modify-write en mémoire.
   * Retourne 0 si la ligne n'existe pas (le service doit valider avant d'appeler).
   */
  @Modifying
  @Query(value = """
      UPDATE stock
      SET quantite_disponible = quantite_disponible - :delta,
          updated_at          = NOW()
      WHERE id_lot  = :idLot
        AND id_site = (SELECT id FROM site WHERE code_site = :codeSite)
      """, nativeQuery = true)
  int debitQuantite(@Param("idLot") Long idLot,
                    @Param("codeSite") String codeSite,
                    @Param("delta") BigDecimal delta);

  /**
   * Crédit atomique avec UPSERT PostgreSQL.
   * Crée la ligne si absente (IN ou premier dépôt d'un multiplicateur),
   * sinon incrémente quantite_disponible. Thread-safe par nature.
   */
  @Modifying
  @Query(value = """
      INSERT INTO stock (id_lot, id_site, quantite_disponible, unite, updated_at, created_at)
      VALUES (
          :idLot,
          (SELECT id FROM site WHERE code_site = :codeSite),
          :delta,
          :unite,
          NOW(),
          NOW()
      )
      ON CONFLICT (id_lot, id_site)
      DO UPDATE SET
          quantite_disponible = stock.quantite_disponible + :delta,
          updated_at          = NOW()
      """, nativeQuery = true)
  void creditQuantite(@Param("idLot") Long idLot,
                      @Param("codeSite") String codeSite,
                      @Param("delta") BigDecimal delta,
                      @Param("unite") String unite);

  /**
   * Stock d'un multiplicateur : uniquement les lots dont il est l'org producteur,
   * stockés sur ses propres sites. Double filtre site ET lot pour éviter de voir
   * les lots d'autres organisations (ex : lots UPSemCL transférés par erreur).
   */
  @Query(value = """
      SELECT s.id, s.id_lot, s.id_site, s.quantite_disponible, s.unite, s.updated_at, s.created_at
      FROM stock s
      JOIN lot_semencier l ON l.id  = s.id_lot
      JOIN site si         ON si.id = s.id_site
      WHERE si.id_organisation      = :orgId
        AND l.id_org_producteur     = :orgId
      ORDER BY s.updated_at DESC NULLS LAST
      """, nativeQuery = true)
  List<Stock> findByOrganisation(@Param("orgId") Long orgId);

  @Query(value = """
      SELECT s.id, s.id_lot, s.id_site, s.quantite_disponible, s.unite, s.updated_at, s.created_at
      FROM stock s
      JOIN lot_semencier l ON l.id  = s.id_lot
      JOIN site si         ON si.id = s.id_site
      WHERE si.id_organisation      = :orgId
        AND l.id_org_producteur     = :orgId
      ORDER BY s.updated_at DESC NULLS LAST
      """,
      countQuery = """
      SELECT COUNT(*) FROM stock s
      JOIN lot_semencier l ON l.id  = s.id_lot
      JOIN site si         ON si.id = s.id_site
      WHERE si.id_organisation  = :orgId
        AND l.id_org_producteur = :orgId
      """, nativeQuery = true)
  Page<Stock> findByOrganisation(@Param("orgId") Long orgId, Pageable pageable);

  /** Vue agrégée par (variété, génération, site) — tous les rôles sauf multiplicateur. */
  @Query(value = """
      SELECT
          id_variete       AS idVariete,
          id_generation    AS idGeneration,
          id_site          AS idSite,
          code_site        AS codeSite,
          nom_site         AS nomSite,
          code_generation  AS codeGeneration,
          nom_variete      AS nomVariete,
          code_variete     AS codeVariete,
          nom_espece       AS nomEspece,
          code_espece      AS codeEspece,
          unite,
          quantite_totale  AS quantiteTotale,
          nb_lots          AS nbLots,
          TO_CHAR(derniere_maj AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS derniereMaj,
          TO_CHAR(premiere_entree AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS createdAt,
          lots_detail::text AS lotsDetail
      FROM v_stock_agrege
      ORDER BY code_generation, nom_variete, code_site
      """, nativeQuery = true)
  List<StockAgregeView> findAllAgrege();

  /**
   * Vue agrégée filtrée pour un multiplicateur : uniquement ses propres lots.
   * Requête directe (sans v_stock_agrege) pour pouvoir filtrer sur id_org_producteur
   * et garantir qu'aucun lot d'une autre organisation ne remonte dans les totaux.
   */
  @Query(value = """
      SELECT
          ls.id_variete                                                               AS idVariete,
          ls.id_generation                                                            AS idGeneration,
          s.id_site                                                                   AS idSite,
          si.code_site                                                                AS codeSite,
          si.nom_site                                                                 AS nomSite,
          g.code_generation                                                           AS codeGeneration,
          v.nom_variete                                                               AS nomVariete,
          v.code_variete                                                              AS codeVariete,
          e.nom_commun                                                                AS nomEspece,
          e.code_espece                                                               AS codeEspece,
          s.unite,
          SUM(s.quantite_disponible)                                                  AS quantiteTotale,
          COUNT(DISTINCT s.id)                                                        AS nbLots,
          TO_CHAR(MAX(s.updated_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS derniereMaj,
          TO_CHAR(MIN(s.created_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS createdAt,
          json_agg(json_build_object(
              'idStock',   s.id,
              'idLot',     ls.id,
              'codeLot',   ls.code_lot,
              'quantite',  s.quantite_disponible,
              'unite',     s.unite,
              'statut',    ls.statut_lot,
              'campagne',  ls.campagne,
              'createdAt', to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ) ORDER BY s.created_at)::text                                              AS lotsDetail
      FROM stock s
      JOIN lot_semencier ls     ON s.id_lot      = ls.id
      JOIN site si              ON s.id_site      = si.id
      JOIN generation_semence g ON ls.id_generation = g.id
      JOIN variete v            ON ls.id_variete    = v.id
      JOIN espece e             ON v.id_espece      = e.id
      WHERE si.id_organisation   = :orgId
        AND ls.id_org_producteur = :orgId
      GROUP BY ls.id_variete, ls.id_generation, s.id_site, si.code_site, si.nom_site,
               g.code_generation, v.nom_variete, v.code_variete, e.nom_commun, e.code_espece, s.unite
      ORDER BY g.code_generation, v.nom_variete, si.code_site
      """, nativeQuery = true)
  List<StockAgregeView> findAgregeByOrganisation(@Param("orgId") Long orgId);

  /**
   * Vue agrégée pour un sélectionneur : ses propres lots G0/G1, uniquement sur les sites
   * de son organisation (exclut les entrées UPSEMCL créées après transfert).
   */
  @Query(value = """
      SELECT
          ls.id_variete                                                               AS idVariete,
          ls.id_generation                                                            AS idGeneration,
          s.id_site                                                                   AS idSite,
          si.code_site                                                                AS codeSite,
          si.nom_site                                                                 AS nomSite,
          g.code_generation                                                           AS codeGeneration,
          v.nom_variete                                                               AS nomVariete,
          v.code_variete                                                              AS codeVariete,
          e.nom_commun                                                                AS nomEspece,
          e.code_espece                                                               AS codeEspece,
          s.unite,
          SUM(s.quantite_disponible)                                                  AS quantiteTotale,
          COUNT(DISTINCT s.id)                                                        AS nbLots,
          TO_CHAR(MAX(s.updated_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS derniereMaj,
          TO_CHAR(MIN(s.created_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS createdAt,
          json_agg(json_build_object(
              'idStock',   s.id,
              'idLot',     ls.id,
              'codeLot',   ls.code_lot,
              'quantite',  s.quantite_disponible,
              'unite',     s.unite,
              'statut',    ls.statut_lot,
              'campagne',  ls.campagne,
              'createdAt', to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ) ORDER BY s.created_at)::text                                              AS lotsDetail
      FROM stock s
      JOIN lot_semencier ls     ON s.id_lot         = ls.id
      JOIN site si              ON s.id_site         = si.id
      JOIN generation_semence g ON ls.id_generation  = g.id
      JOIN variete v            ON ls.id_variete     = v.id
      JOIN espece e             ON v.id_espece       = e.id
      WHERE ls.username_createur = :username
        AND g.code_generation IN ('G0','G1')
        AND si.id_organisation = (
            SELECT mo.id_organisation FROM membre_organisation mo
            WHERE mo.keycloak_username = :username LIMIT 1
        )
      GROUP BY ls.id_variete, ls.id_generation, s.id_site, si.code_site, si.nom_site,
               g.code_generation, v.nom_variete, v.code_variete, e.nom_commun, e.code_espece, s.unite
      ORDER BY g.code_generation, v.nom_variete, si.code_site
      """, nativeQuery = true)
  List<StockAgregeView> findAgregeByUsernameCreateur(@Param("username") String username);

  /**
   * Catalogue public : stocks R1/R2 disponibles chez les multiplicateurs.
   * Filtre optionnel par code espèce et zone agro-écologique.
   * Tri : niveau adaptation (OPTIMAL→ACCEPTABLE→MARGINALE→sans zone) puis quantité DESC.
   */
  @Query(value = """
      SELECT
          v.id                   AS varieteId,
          v.nom_variete          AS nomVariete,
          v.code_variete         AS codeVariete,
          e.nom_commun           AS nomEspece,
          e.code_espece          AS codeEspece,
          ls.id                  AS lotId,
          ls.code_lot            AS codeLot,
          g.code_generation      AS generation,
          ls.campagne            AS campagne,
          ls.taux_germination    AS tauxGermination,
          s.quantite_disponible  AS quantiteDisponible,
          s.unite                AS unite,
          si.id                  AS siteId,
          si.nom_site            AS nomSite,
          si.region              AS region,
          o.id                   AS organisationId,
          o.nom_organisation     AS nomOrganisation,
          /* Coordonnées : site en priorité, fallback organisation */
          COALESCE(si.latitude,  o.latitude)  AS latitude,
          COALESCE(si.longitude, o.longitude) AS longitude,
          vz.niveau_adaptation   AS niveauAdaptation,
          COALESCE(mo.nom_complet, o.nom_organisation) AS nomComplet
      FROM stock s
      JOIN lot_semencier ls   ON s.id_lot = ls.id
      JOIN generation_semence g ON ls.id_generation = g.id
      JOIN variete v          ON ls.id_variete = v.id
      JOIN espece e           ON v.id_espece = e.id
      JOIN site si            ON s.id_site = si.id
      JOIN organisation o     ON si.id_organisation = o.id
      LEFT JOIN shared.membre_organisation mo ON mo.keycloak_username = ls.username_createur
      LEFT JOIN variete_zone vz
          ON v.id = vz.id_variete
          AND vz.id_zone = CAST(:idZone AS BIGINT)
      WHERE g.code_generation IN ('R1','R2')
        AND s.quantite_disponible > 0
        AND ls.statut_lot = 'DISPONIBLE'
        AND o.active = true
        AND (:codeEspece IS NULL OR e.code_espece = :codeEspece)
        AND (:idZone IS NULL OR vz.id_zone IS NOT NULL)
      ORDER BY
          CASE vz.niveau_adaptation
              WHEN 'OPTIMAL'    THEN 1
              WHEN 'ACCEPTABLE' THEN 2
              WHEN 'MARGINALE'  THEN 3
              ELSE 4
          END,
          s.quantite_disponible DESC
      """, nativeQuery = true)
  List<CatalogueItem> findCatalogue(
      @Param("codeEspece") String codeEspece,
      @Param("idZone")     Long idZone
  );

  /**
   * Catalogue de proximité : stocks R1/R2 dans un rayon donné (haversine).
   * Filtre optionnel par idVariete. Tri par distance ASC.
   */
  @Query(value = """
      WITH dist AS (
          SELECT
              v.id                   AS varieteId,
              v.nom_variete          AS nomVariete,
              v.code_variete         AS codeVariete,
              e.nom_commun           AS nomEspece,
              e.code_espece          AS codeEspece,
              ls.id                  AS lotId,
              ls.code_lot            AS codeLot,
              g.code_generation      AS generation,
              ls.campagne            AS campagne,
              ls.taux_germination    AS tauxGermination,
              s.quantite_disponible  AS quantiteDisponible,
              s.unite                AS unite,
              si.id                  AS siteId,
              si.nom_site            AS nomSite,
              si.region              AS region,
              o.id                   AS organisationId,
              o.nom_organisation     AS nomOrganisation,
              /* Coordonnées : site en priorité, fallback organisation */
              COALESCE(si.latitude,  o.latitude)  AS latitude,
              COALESCE(si.longitude, o.longitude) AS longitude,
              NULL::text             AS niveauAdaptation,
              COALESCE(mo.nom_complet, o.nom_organisation) AS nomComplet,
              6371.0 * acos(LEAST(1.0,
                  cos(radians(CAST(:lat AS double precision)))
                  * cos(radians(COALESCE(si.latitude,  o.latitude)::double precision))
                  * cos(radians(COALESCE(si.longitude, o.longitude)::double precision) - radians(CAST(:lng AS double precision)))
                  + sin(radians(CAST(:lat AS double precision)))
                  * sin(radians(COALESCE(si.latitude,  o.latitude)::double precision))
              ))                     AS distanceKm
          FROM stock s
          JOIN lot_semencier ls       ON s.id_lot = ls.id
          JOIN generation_semence g   ON ls.id_generation = g.id
          JOIN variete v              ON ls.id_variete = v.id
          JOIN espece e               ON v.id_espece = e.id
          JOIN site si                ON s.id_site = si.id
          JOIN organisation o         ON si.id_organisation = o.id
          LEFT JOIN shared.membre_organisation mo ON mo.keycloak_username = ls.username_createur
          WHERE g.code_generation IN ('R1','R2')
            AND s.quantite_disponible > 0
            AND ls.statut_lot = 'DISPONIBLE'
            AND o.active = true
            /* Au moins une source de coordonnées disponible */
            AND (si.latitude IS NOT NULL OR o.latitude IS NOT NULL)
            AND (:idVariete IS NULL OR v.id = CAST(:idVariete AS BIGINT))
      )
      SELECT * FROM dist
      WHERE distanceKm <= CAST(:rayonKm AS double precision)
      ORDER BY distanceKm ASC
      """, nativeQuery = true)
  List<CatalogueProximiteItem> findCatalogueProximite(
      @Param("lat")       double lat,
      @Param("lng")       double lng,
      @Param("rayonKm")   double rayonKm,
      @Param("idVariete") Long idVariete
  );
}
