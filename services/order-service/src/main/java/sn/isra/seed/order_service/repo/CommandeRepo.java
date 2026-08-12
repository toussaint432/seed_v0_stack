package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Commande;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface CommandeRepo extends JpaRepository<Commande, Long> {
    List<Commande> findByUsernameAcheteurOrderByCreatedAtDesc(String username);
    List<Commande> findByIdOrganisationFournisseurOrderByCreatedAtDesc(Long orgId);
    List<Commande> findByIdOrganisationAcheteurOrderByCreatedAtDesc(Long orgId);

    Page<Commande> findByUsernameAcheteurOrderByCreatedAtDesc(String username, Pageable pageable);
    Page<Commande> findByIdOrganisationFournisseurOrderByCreatedAtDesc(Long orgId, Pageable pageable);

    @Query("SELECT c FROM Commande c WHERE c.idOrganisationFournisseur IN " +
           "(SELECT o.id FROM Organisation o WHERE o.typeOrganisation = sn.isra.seed.order_service.entity.enums.TypeOrganisation.UPSEMCL) " +
           "OR c.idOrganisationFournisseur IS NULL ORDER BY c.createdAt DESC")
    List<Commande> findForAnyUpsemcl();

    @Query("SELECT c FROM Commande c WHERE c.idOrganisationFournisseur IN " +
           "(SELECT o.id FROM Organisation o WHERE o.typeOrganisation = sn.isra.seed.order_service.entity.enums.TypeOrganisation.UPSEMCL) " +
           "OR c.idOrganisationFournisseur IS NULL ORDER BY c.createdAt DESC")
    Page<Commande> findForAnyUpsemcl(Pageable pageable);
}
