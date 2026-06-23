package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Departement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DepartementRepo extends JpaRepository<Departement, Integer> {

    List<Departement> findAllByOrderByNomAsc();

    List<Departement> findByRegionIdOrderByNomAsc(Integer regionId);

    Optional<Departement> findByNomIgnoreCase(String nom);
}
