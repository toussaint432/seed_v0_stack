package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SiteRepo extends JpaRepository<Site, Long> {
  Optional<Site> findByCodeSite(String codeSite);
}
