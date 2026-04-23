package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.AllocationCommande;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AllocationRepo extends JpaRepository<AllocationCommande, Long> {
    List<AllocationCommande> findByLigne_Id(Long ligneId);
}
