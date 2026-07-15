package sn.isra.seed.catalog_service.repo;

import sn.isra.seed.catalog_service.entity.VarieteHistorique;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VarieteHistoriqueRepo extends JpaRepository<VarieteHistorique, Long> {
    List<VarieteHistorique> findByIdVarieteOrderByDateModificationDesc(Long idVariete);
}
