package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Region;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegionRepo extends JpaRepository<Region, Integer> {

    List<Region> findAllByOrderByNomAsc();
}
