package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface VarieteRepo extends JpaRepository<Variete, Long> {
  Optional<Variete> findByCodeVariete(String codeVariete);

  List<Variete> findAllByOrderByNomVarieteAsc();
  List<Variete> findByEspece_IdOrderByNomVarieteAsc(Long especeId);
  List<Variete> findByStatutVarieteOrderByNomVarieteAsc(StatutVariete statut);

  Page<Variete> findAllByOrderByNomVarieteAsc(Pageable pageable);
  Page<Variete> findByEspece_IdOrderByNomVarieteAsc(Long especeId, Pageable pageable);
  Page<Variete> findByStatutVarieteOrderByNomVarieteAsc(StatutVariete statut, Pageable pageable);

  /** @deprecated utiliser les variantes OrderByNomVarieteAsc */
  List<Variete> findByEspece_Id(Long especeId);
  List<Variete> findByStatutVariete(StatutVariete statut);

  @Query(value = "SELECT COUNT(*) FROM lot_semencier WHERE id_variete = :id", nativeQuery = true)
  long countLotsParVariete(@Param("id") Long id);

  @Query(value = "SELECT COUNT(*) FROM ligne_commande WHERE id_variete = :id", nativeQuery = true)
  long countCommandesParVariete(@Param("id") Long id);
}
