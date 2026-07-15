package sn.isra.seed.catalog_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.catalog_service.entity.EspeceHistorique;

import java.util.List;

public interface EspeceHistoriqueRepo extends JpaRepository<EspeceHistorique, Long> {
    List<EspeceHistorique> findByIdEspeceOrderByDateModificationDesc(Long idEspece);
}
