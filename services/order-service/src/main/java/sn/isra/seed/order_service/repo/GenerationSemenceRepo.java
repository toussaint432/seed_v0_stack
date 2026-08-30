package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.order_service.entity.GenerationSemence;

public interface GenerationSemenceRepo extends JpaRepository<GenerationSemence, Long> {}
