package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Commande;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommandeRepo extends JpaRepository<Commande, Long> {
    List<Commande> findByUsernameAcheteurOrderByCreatedAtDesc(String username);
    List<Commande> findByIdOrganisationFournisseurOrderByCreatedAtDesc(Long orgId);

    /** Commandes passées PAR l'organisation du multiplicateur (ses demandes de G3 à l'UPSemCL) */
    List<Commande> findByIdOrganisationAcheteurOrderByCreatedAtDesc(Long orgId);
}
