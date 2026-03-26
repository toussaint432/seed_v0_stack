package sn.isra.seed.lot_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.lot_service.entity.ControleQualite;
import java.util.List;

public interface ControleQualiteRepo extends JpaRepository<ControleQualite, Long> {
    List<ControleQualite> findByIdLot(Long idLot);
}
