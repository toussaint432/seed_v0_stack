package sn.isra.seed.lot_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import sn.isra.seed.lot_service.entity.LotAuditLog;
import sn.isra.seed.lot_service.entity.enums.StatutEdition;
import sn.isra.seed.lot_service.repo.LotAuditLogRepo;
import sn.isra.seed.lot_service.repo.LotRepo;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Verrouille automatiquement les lots restés en BROUILLON au-delà de 30 jours.
 * S'exécute chaque nuit à 2h00 UTC.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotAutoLockJob {

    private final LotRepo         lotRepo;
    private final LotAuditLogRepo auditLogRepo;

    @Scheduled(cron = "0 0 2 * * *")
    public void autoLockExpiredBrouillons() {
        Instant limite = Instant.now().minus(30, ChronoUnit.DAYS);
        var lots = lotRepo.findBrouillonsAnciensDe(limite, StatutEdition.BROUILLON);
        if (lots.isEmpty()) return;

        log.info("[AutoLock] {} lot(s) BROUILLON dépassant 30 jours — verrouillage automatique", lots.size());
        for (var lot : lots) {
            lot.setStatutEdition(StatutEdition.CONFIRME);
            lot.setDateConfirmation(Instant.now());
            auditLogRepo.save(LotAuditLog.confirmation(lot.getId(), "system:auto-lock-30j"));
        }
        lotRepo.saveAll(lots);
    }
}
