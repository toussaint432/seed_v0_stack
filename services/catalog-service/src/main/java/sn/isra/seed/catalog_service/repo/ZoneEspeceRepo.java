package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.ZoneEspece;
import sn.isra.seed.catalog_service.entity.ZoneEspeceId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ZoneEspeceRepo extends JpaRepository<ZoneEspece, ZoneEspeceId> {

    List<ZoneEspece> findByIdIdZoneAgro(Long idZoneAgro);

    List<ZoneEspece> findByIdIdEspece(Long idEspece);
}
