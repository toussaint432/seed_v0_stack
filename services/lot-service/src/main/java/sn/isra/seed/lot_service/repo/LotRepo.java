package sn.isra.seed.lot_service.repo;
import sn.isra.seed.lot_service.entity.LotSemencier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface LotRepo extends JpaRepository<LotSemencier, Long> {
  Optional<LotSemencier> findByCodeLot(String codeLot);
  List<LotSemencier> findByGeneration_CodeGeneration(String codeGeneration);
  List<LotSemencier> findByIdVariete(Long idVariete);
}
