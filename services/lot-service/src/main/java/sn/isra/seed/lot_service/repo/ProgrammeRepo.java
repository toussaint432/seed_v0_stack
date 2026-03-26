package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.Programme;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProgrammeRepo extends JpaRepository<Programme, Long> {
    List<Programme> findByIdLot(Long idLot);
    List<Programme> findByStatut(String statut);
}
