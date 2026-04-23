package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface SiteRepo extends JpaRepository<Site, Long> {

  Optional<Site> findByCodeSite(String codeSite);

  /**
   * Résolution site ← type d'organisation.
   * Utilisé par le LotTransferConsumer pour déterminer automatiquement
   * le site destination à partir du rôle Keycloak du destinataire.
   * Retourne le premier site actif de l'organisation correspondante.
   */
  @Query(value = """
      SELECT s.code_site FROM site s
      JOIN organisation o ON s.id_organisation = o.id
      WHERE o.type_organisation = :typeOrg AND o.active = true
      ORDER BY s.id
      LIMIT 1
      """, nativeQuery = true)
  Optional<String> findCodeSiteByOrgType(@Param("typeOrg") String typeOrg);
}
