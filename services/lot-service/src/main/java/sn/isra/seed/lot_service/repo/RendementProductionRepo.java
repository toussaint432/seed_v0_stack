package sn.isra.seed.lot_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.lot_service.entity.RendementProduction;

import java.util.List;

public interface RendementProductionRepo extends JpaRepository<RendementProduction, Long> {

    List<RendementProduction> findByProgramme_Id(Long idProgramme);
}
