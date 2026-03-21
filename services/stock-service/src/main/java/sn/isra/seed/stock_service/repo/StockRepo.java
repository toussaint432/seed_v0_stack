package sn.isra.seed.stock_service.repo;

import sn.isra.seed.stock_service.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StockRepo extends JpaRepository<Stock, Long> {
  List<Stock> findBySite_CodeSite(String codeSite);
  Optional<Stock> findByIdLotAndSite_CodeSite(Long idLot, String codeSite);
}
