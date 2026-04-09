package sn.isra.seed.lot_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.lot_service.entity.ParcelleMultiplication;

import java.util.List;

public interface ParcelleMultiplicationRepo extends JpaRepository<ParcelleMultiplication, Long> {

    List<ParcelleMultiplication> findByProgramme_Id(Long idProgramme);
}
