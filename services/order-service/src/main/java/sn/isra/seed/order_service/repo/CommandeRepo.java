package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Commande;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommandeRepo extends JpaRepository<Commande, Long> {
    List<Commande> findByUsernameAcheteurOrderByCreatedAtDesc(String username);
    List<Commande> findByIdOrganisationFournisseurOrderByCreatedAtDesc(Long orgId);
}
