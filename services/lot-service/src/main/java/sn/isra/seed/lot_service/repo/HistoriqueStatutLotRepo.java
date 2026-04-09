package sn.isra.seed.lot_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;

import java.util.List;

public interface HistoriqueStatutLotRepo extends JpaRepository<HistoriqueStatutLot, Long> {

    /** Historique complet d'un lot, du plus récent au plus ancien */
    List<HistoriqueStatutLot> findByIdLotOrderByCreatedAtDesc(Long idLot);
}
