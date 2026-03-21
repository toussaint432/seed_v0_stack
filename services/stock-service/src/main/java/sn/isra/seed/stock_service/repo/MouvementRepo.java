package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.MouvementStock;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MouvementRepo extends JpaRepository<MouvementStock, Long> {}
