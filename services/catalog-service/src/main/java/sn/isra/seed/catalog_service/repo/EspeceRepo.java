package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Espece;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EspeceRepo extends JpaRepository<Espece, Long> {}
