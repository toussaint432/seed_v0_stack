package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.Generation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GenerationRepo extends JpaRepository<Generation, Long> {
  Optional<Generation> findByCodeGeneration(String codeGeneration);
}
