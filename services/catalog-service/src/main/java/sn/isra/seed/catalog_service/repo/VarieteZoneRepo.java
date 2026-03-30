package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.VarieteZone;
import sn.isra.seed.catalog_service.entity.VarieteZoneId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface VarieteZoneRepo extends JpaRepository<VarieteZone, VarieteZoneId> {

    List<VarieteZone> findByIdIdVariete(Long idVariete);

    @Modifying
    @Query("DELETE FROM VarieteZone vz WHERE vz.id.idVariete = :idVariete")
    void deleteByVarieteId(@Param("idVariete") Long idVariete);
}
