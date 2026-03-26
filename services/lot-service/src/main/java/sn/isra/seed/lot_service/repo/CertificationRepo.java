package sn.isra.seed.lot_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.lot_service.entity.Certification;
import java.util.List;

public interface CertificationRepo extends JpaRepository<Certification, Long> {
    List<Certification> findByIdLot(Long idLot);
}
