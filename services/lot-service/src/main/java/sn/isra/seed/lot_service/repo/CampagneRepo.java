package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.Campagne;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampagneRepo extends JpaRepository<Campagne, Long> {
    List<Campagne> findByAnnee(Integer annee);
    List<Campagne> findByStatut(String statut);
}
