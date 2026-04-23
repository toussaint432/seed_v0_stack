package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Commande;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface CommandeRepo extends JpaRepository<Commande, Long> {
    List<Commande> findByUsernameAcheteurOrderByCreatedAtDesc(String username);
    List<Commande> findByIdOrganisationFournisseurOrderByCreatedAtDesc(Long orgId);

    /** Commandes passées PAR l'organisation du multiplicateur (ses demandes de G3 à l'UPSemCL) */
    List<Commande> findByIdOrganisationAcheteurOrderByCreatedAtDesc(Long orgId);

    /**
     * Toutes les commandes G3 destinées à n'importe quelle organisation UPSemCL,
     * plus les commandes sans fournisseur explicite (soumises avant correction).
     * Filtre par type d'organisation pour éviter les problèmes d'ID cross-org.
     */
    @Query("SELECT c FROM Commande c WHERE c.idOrganisationFournisseur IN " +
           "(SELECT o.id FROM Organisation o WHERE o.typeOrganisation = sn.isra.seed.order_service.entity.enums.TypeOrganisation.UPSEMCL) " +
           "OR c.idOrganisationFournisseur IS NULL ORDER BY c.createdAt DESC")
    List<Commande> findForAnyUpsemcl();
}
