package sn.isra.seed.lot_service.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import sn.isra.seed.lot_service.entity.OutboxEvent;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutTransfert;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.OutboxEventRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/transferts")
@RequiredArgsConstructor
public class TransfertController {

    private final TransfertLotRepo transfertRepo;
    private final LotRepo          lotRepo;
    private final OutboxEventRepo  outboxRepo;
    private final ObjectMapper     om;

    /* ── GET /api/transferts — tous les transferts du connecté ── */
    @GetMapping
    public List<TransfertLot> mesTransferts(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        return transfertRepo.findByParticipant(username);
    }

    /* ── GET /api/transferts/recus — EN_ATTENTE pour le connecté ── */
    @GetMapping("/recus")
    public List<TransfertLot> transfertsRecus(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        return transfertRepo.findPendingForDestinataire(username);
    }

    /* ── PUT /api/transferts/{id}/accepter ─────────────────────── */
    @Transactional
    @PutMapping("/{id}/accepter")
    public ResponseEntity<?> accepter(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        TransfertLot t = transfertRepo.findById(id).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();
        if (!t.getUsernameDestinataire().equals(username))
            return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));
        if (StatutTransfert.EN_ATTENTE != t.getStatut())
            return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

        t.setStatut(StatutTransfert.ACCEPTE);
        t.setDateAcceptation(LocalDate.now());

        // Déduire la quantité transférée du stock du lot source
        lotRepo.findById(t.getIdLot()).ifPresent(lot -> {
            lot.setStatutLot(StatutLot.TRANSFERE);
            if (t.getQuantite() != null && lot.getQuantiteNette() != null) {
                BigDecimal restant = lot.getQuantiteNette().subtract(t.getQuantite());
                lot.setQuantiteNette(restant.compareTo(BigDecimal.ZERO) >= 0 ? restant : BigDecimal.ZERO);
            }
            lotRepo.save(lot);
        });

        TransfertLot saved = transfertRepo.save(t);

        // Outbox — même transaction, durabilité garantie vers Kafka après commit
        try {
            String payload = om.writeValueAsString(Map.of(
                "idTransfertLot",   saved.getId(),
                "codeTransfert",    saved.getCodeTransfert(),
                "idLot",            saved.getIdLot(),
                "quantite",         saved.getQuantite(),
                "unite",            "kg",
                "roleEmetteur",     saved.getRoleEmetteur(),
                "roleDestinataire", saved.getRoleDestinataire()
            ));
            OutboxEvent event = new OutboxEvent();
            event.setAggregateType("TransfertLot");
            event.setAggregateId(saved.getId().toString());
            event.setType("LOT_TRANSFER_ACCEPTE");
            event.setPayload(payload);
            outboxRepo.save(event);
        } catch (Exception e) {
            log.error("Impossible de sérialiser l'événement outbox pour le transfert lot {}",
                      saved.getCodeTransfert(), e);
        }

        return ResponseEntity.<Object>ok(saved);
    }

    /* ── PUT /api/transferts/{id}/refuser ──────────────────────── */
    @PutMapping("/{id}/refuser")
    public ResponseEntity<?> refuser(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        return transfertRepo.findById(id).map(t -> {
            if (!t.getUsernameDestinataire().equals(username))
                return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));
            if (StatutTransfert.EN_ATTENTE != t.getStatut())
                return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

            t.setStatut(StatutTransfert.REJETE);
            t.setMotifRefus(body.getOrDefault("motif", "Refusé par le destinataire"));
            return ResponseEntity.<Object>ok(transfertRepo.save(t));
        }).orElse(ResponseEntity.notFound().build());
    }
}
