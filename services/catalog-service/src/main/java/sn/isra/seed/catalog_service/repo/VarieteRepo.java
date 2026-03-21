package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Variete;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VarieteRepo extends JpaRepository<Variete, Long> {
  Optional<Variete> findByCodeVariete(String codeVariete);
  List<Variete> findByEspece_Id(Long especeId);
  List<Variete> findByStatutVariete(String statut);
}
