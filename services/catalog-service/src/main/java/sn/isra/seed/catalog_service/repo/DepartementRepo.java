package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Departement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DepartementRepo extends JpaRepository<Departement, Integer> {

    List<Departement> findAllByOrderByNomAsc();

    List<Departement> findByRegionIdOrderByNomAsc(Integer regionId);

    Optional<Departement> findByNomIgnoreCase(String nom);

    @Query(value = """
        SELECT d.* FROM geo.departements d
        JOIN geo.departement_zone dz ON dz.id_departement = d.id
        WHERE dz.id_zone = :zoneId
        ORDER BY d.nom ASC
        """, nativeQuery = true)
    List<Departement> findByZoneAgroIdOrderByNomAsc(@Param("zoneId") Integer zoneId);
}
