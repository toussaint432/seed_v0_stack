package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Espece;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EspeceRepo extends JpaRepository<Espece, Long> {
  List<Espece> findAllByOrderByNomCommunAsc();
}
