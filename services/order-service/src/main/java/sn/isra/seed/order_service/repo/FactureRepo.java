package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Facture;
import sn.isra.seed.order_service.entity.enums.StatutFacture;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FactureRepo extends JpaRepository<Facture, Long> {

    Optional<Facture> findByCommande_Id(Long idCommande);

    /** Factures émises par un utilisateur (vendeur) */
    Page<Facture> findByUsernameEmetteurOrderByDateEmissionDesc(String username, Pageable pageable);

    /** Factures reçues par un acheteur (via le username de la commande) */
    @Query("""
        SELECT f FROM Facture f
        WHERE f.commande.usernameAcheteur = :username
        ORDER BY f.dateEmission DESC
        """)
    Page<Facture> findByAcheteur(@Param("username") String username, Pageable pageable);

    /** Toutes les factures d'une organisation fournisseur */
    @Query("""
        SELECT f FROM Facture f
        WHERE f.commande.idOrganisationFournisseur = :orgId
        ORDER BY f.dateEmission DESC
        """)
    Page<Facture> findByOrganisationFournisseur(@Param("orgId") Long orgId, Pageable pageable);

    /** Factures par statut pour l'admin */
    Page<Facture> findByStatutOrderByDateEmissionDesc(StatutFacture statut, Pageable pageable);

    /** Liste simple pour une commande (résultat attendu : 0 ou 1) */
    List<Facture> findByCommande_IdOrderByDateEmissionDesc(Long idCommande);

    /** Toutes les factures triées — ORDER BY embarqué pour contourner le bug Hibernate 6 naming strategy */
    @Query("SELECT f FROM Facture f ORDER BY f.dateEmission DESC")
    Page<Facture> findAllByDateDesc(Pageable pageable);
}
