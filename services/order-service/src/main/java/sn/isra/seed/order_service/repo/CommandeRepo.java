package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Commande;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // ── Compteurs pour badges d'alerte ────────────────────────────────────────

    @Query("SELECT COUNT(c) FROM Commande c WHERE c.idOrganisationFournisseur = :orgId AND c.statut = sn.isra.seed.order_service.entity.enums.StatutCommande.SOUMISE")
    long countSoumisesFournisseur(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(c) FROM Commande c WHERE c.usernameAcheteur = :username AND c.statut = sn.isra.seed.order_service.entity.enums.StatutCommande.SOUMISE")
    long countSoumisesAcheteur(@Param("username") String username);

    @Query("SELECT COUNT(c) FROM Commande c WHERE c.typeCommande = sn.isra.seed.order_service.entity.enums.TypeCommande.G3_UPSEMCL_MULT AND (c.idOrganisationFournisseur IN (SELECT o.id FROM Organisation o WHERE o.typeOrganisation = sn.isra.seed.order_service.entity.enums.TypeOrganisation.UPSEMCL) OR c.idOrganisationFournisseur IS NULL) AND c.statut = sn.isra.seed.order_service.entity.enums.StatutCommande.SOUMISE")
    long countSoumisesForUpsemcl();

    /** Commandes EN_NEGOCIATION dont le quotataire est l'acheteur — besoin de décision */
    @Query("SELECT COUNT(c) FROM Commande c WHERE c.usernameAcheteur = :username AND c.statut = sn.isra.seed.order_service.entity.enums.StatutCommande.EN_NEGOCIATION")
    long countEnNegociationAcheteur(@Param("username") String username);
}
