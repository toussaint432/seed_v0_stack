package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.LigneCommande;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LigneRepo extends JpaRepository<LigneCommande, Long> {}
