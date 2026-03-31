package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.MembreOrganisation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MembreOrganisationRepo extends JpaRepository<MembreOrganisation, Long> {
    Optional<MembreOrganisation> findByKeycloakUsername(String keycloakUsername);
    boolean existsByKeycloakUsername(String keycloakUsername);
    List<MembreOrganisation> findByOrganisation_Id(Long organisationId);
    List<MembreOrganisation> findByKeycloakRole(String keycloakRole);
}
