package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sn.isra.seed.order_service.entity.Bordereau;

import java.util.List;
import java.util.Optional;

public interface BordereauRepo extends JpaRepository<Bordereau, Long> {

    Optional<Bordereau> findByIdCommande(Long idCommande);

    @Query("""
        SELECT b FROM Bordereau b
        WHERE b.idOrgEmetteur = :idOrg OR b.idOrgDestinataire = :idOrg
        ORDER BY b.dateEmission DESC
        """)
    List<Bordereau> findByOrganisation(@Param("idOrg") Long idOrg);
}
