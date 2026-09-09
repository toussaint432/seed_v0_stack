package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.PropositionLigne;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PropositionLigneRepo extends JpaRepository<PropositionLigne, Long> {
    Optional<PropositionLigne> findByLigneCommande_Id(Long idLigne);
}
