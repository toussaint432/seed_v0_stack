package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.ReceptionCommande;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReceptionCommandeRepo extends JpaRepository<ReceptionCommande, Long> {
    Optional<ReceptionCommande> findByCommande_Id(Long idCommande);
}
