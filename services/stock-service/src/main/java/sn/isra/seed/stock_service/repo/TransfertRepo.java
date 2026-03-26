package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.Transfert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransfertRepo extends JpaRepository<Transfert, Long> {
    List<Transfert> findByRoleSource(String roleSource);
    List<Transfert> findByIdLot(Long idLot);
}
