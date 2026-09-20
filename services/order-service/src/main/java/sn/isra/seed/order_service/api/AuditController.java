package sn.isra.seed.order_service.api;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import sn.isra.seed.order_service.repo.UserAuditLogRepo;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final UserAuditLogRepo auditRepo;

    @GetMapping("/mon-activite")
    public List<AuditEntryDto> monActivite(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        return auditRepo.findTop10ByUsernameOrderByCreatedAtDesc(username)
                .stream()
                .map(l -> new AuditEntryDto(
                        l.getId(),
                        l.getActionType(),
                        l.getDescription(),
                        l.getEntityRef(),
                        l.getCreatedAt().toString()
                ))
                .toList();
    }

    public record AuditEntryDto(
            Long id,
            String actionType,
            String description,
            String entityRef,
            String createdAt
    ) {}
}
