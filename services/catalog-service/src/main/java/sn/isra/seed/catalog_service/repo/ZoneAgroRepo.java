package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.ZoneAgro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ZoneAgroRepo extends JpaRepository<ZoneAgro, Long> {

    List<ZoneAgro> findAllByOrderByNomAsc();

    Optional<ZoneAgro> findByCode(String code);

    /**
     * Résolution de la ZAE principale d'un utilisateur via :
     * keycloak_username → membre_organisation → organisation.id_zone_agro → zone_agro.
     * Retourne List pour éviter le ClassCastException de Hibernate 6 avec Optional<Object[]>.
     */
    @Query(value = """
        SELECT z.id, z.code, z.nom, z.description
        FROM zone_agro z
        INNER JOIN organisation o  ON o.id_zone_agro = z.id
        INNER JOIN membre_organisation mo ON mo.id_organisation = o.id
        WHERE mo.keycloak_username = :username
        LIMIT 1
        """, nativeQuery = true)
    List<Object[]> findRawZoneByUsername(@Param("username") String username);

    /**
     * Zone principale d'un département (pour résolution à la saisie de profil).
     */
    @Query(value = """
        SELECT z.id, z.code, z.nom, z.description
        FROM zone_agro z
        INNER JOIN departement_zone dz ON dz.id_zone = z.id
        WHERE dz.id_departement = :deptId
          AND dz.est_principale = TRUE
        LIMIT 1
        """, nativeQuery = true)
    List<Object[]> findRawZoneByDepartementId(@Param("deptId") Integer deptId);
}
