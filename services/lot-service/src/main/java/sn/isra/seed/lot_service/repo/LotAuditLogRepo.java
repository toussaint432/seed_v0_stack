package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.LotAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LotAuditLogRepo extends JpaRepository<LotAuditLog, Long> {
    List<LotAuditLog> findByLotIdOrderByCreatedAtDesc(Long lotId);
}
