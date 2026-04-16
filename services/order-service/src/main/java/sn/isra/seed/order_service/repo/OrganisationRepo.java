package sn.isra.seed.order_service.repo;

import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.entity.enums.TypeOrganisation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrganisationRepo extends JpaRepository<Organisation, Long> {
    List<Organisation> findByTypeOrganisation(TypeOrganisation typeOrganisation);
    List<Organisation> findByActiveTrue();
    List<Organisation> findByRegion(String region);
    Optional<Organisation> findByCodeOrganisation(String codeOrganisation);
}
