package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.api.dto.CatalogueItem;
import sn.isra.seed.stock_service.api.dto.CatalogueProximiteItem;
import sn.isra.seed.stock_service.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface StockRepo extends JpaRepository<Stock, Long> {

  List<Stock> findBySite_CodeSite(String codeSite);
  Optional<Stock> findByIdLotAndSite_CodeSite(Long idLot, String codeSite);

  /**
   * Stock d'une organisation (multiplicateur isolé) : tous ses sites.
   * Joint sur site.id_organisation pour ne retourner que les stocks de son périmètre.
   */
  @Query("SELECT s FROM Stock s WHERE s.site.idOrganisation = :orgId ORDER BY s.updatedAt DESC")
  List<Stock> findByOrganisation(@Param("orgId") Long orgId);

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
          o.latitude             AS latitude,
          o.longitude            AS longitude,
          vz.niveau_adaptation   AS niveauAdaptation
      FROM stock s
      JOIN lot_semencier ls   ON s.id_lot = ls.id
      JOIN generation_semence g ON ls.id_generation = g.id
      JOIN variete v          ON ls.id_variete = v.id
      JOIN espece e           ON v.id_espece = e.id
      JOIN site si            ON s.id_site = si.id
      JOIN organisation o     ON si.id_organisation = o.id
      LEFT JOIN variete_zone vz
          ON v.id = vz.id_variete
          AND (:idZone IS NULL OR vz.id_zone = CAST(:idZone AS BIGINT))
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
              o.latitude             AS latitude,
              o.longitude            AS longitude,
              NULL::text             AS niveauAdaptation,
              6371.0 * acos(LEAST(1.0,
                  cos(radians(CAST(:lat AS double precision)))
                  * cos(radians(o.latitude::double precision))
                  * cos(radians(o.longitude::double precision) - radians(CAST(:lng AS double precision)))
                  + sin(radians(CAST(:lat AS double precision)))
                  * sin(radians(o.latitude::double precision))
              ))                     AS distanceKm
          FROM stock s
          JOIN lot_semencier ls       ON s.id_lot = ls.id
          JOIN generation_semence g   ON ls.id_generation = g.id
          JOIN variete v              ON ls.id_variete = v.id
          JOIN espece e               ON v.id_espece = e.id
          JOIN site si                ON s.id_site = si.id
          JOIN organisation o         ON si.id_organisation = o.id
          WHERE g.code_generation IN ('R1','R2')
            AND s.quantite_disponible > 0
            AND ls.statut_lot = 'DISPONIBLE'
            AND o.active = true
            AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
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
