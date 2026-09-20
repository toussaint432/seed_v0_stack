package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import sn.isra.seed.order_service.entity.UserAuditLog;

import java.util.List;

public interface UserAuditLogRepo extends JpaRepository<UserAuditLog, Long> {
    List<UserAuditLog> findTop10ByUsernameOrderByCreatedAtDesc(String username);
}
