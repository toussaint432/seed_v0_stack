package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.AllocationCommande;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AllocationRepo extends JpaRepository<AllocationCommande, Long> {}
