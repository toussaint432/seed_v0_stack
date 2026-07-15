package sn.isra.seed.lot_service.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.OutboxEvent;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutTransfert;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.OutboxEventRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;

import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/transferts")
@RequiredArgsConstructor
public class TransfertController {

    private final TransfertLotRepo      transfertRepo;
    private final LotRepo               lotRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final OutboxEventRepo        outboxRepo;
    private final LotEventProducer       producer;
    private final ObjectMapper           om;

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

    /**
     * PUT /api/transferts/{id}/accepter
     *
     * Body JSON (optionnel) : { "siteCode": "CNRA-BAMBEY" }
     *   siteCode : code du site de stockage du destinataire.
     *   Quand fourni, le stock est crédité immédiatement via lot.stock.sync.
     *   Sans siteCode, le LotTransferConsumer résout le site par org-type (fallback).
     *
     * Correction bug : la quantiteNette du lot source est déjà déduite lors
     * de l'initiation du transfert (LotController.transfer). Elle NE doit PAS
     * être déduite une seconde fois ici.
     */
    @Transactional
    @PutMapping("/{id}/accepter")
    public ResponseEntity<?> accepter(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        TransfertLot t = transfertRepo.findById(id).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();
        if (!t.getUsernameDestinataire().equals(username))
            return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));
        if (StatutTransfert.EN_ATTENTE != t.getStatut())
            return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

        String siteCode = (body != null) ? (String) body.get("siteCode") : null;

        t.setStatut(StatutTransfert.ACCEPTE);
        t.setDateAcceptation(LocalDate.now());

        // Mise à jour statut lot — quantiteNette déjà déduite lors de l'initiation du transfert.
        // Ne passer à TRANSFERE que si le lot est réellement épuisé (transfert partiel possible).
        lotRepo.findById(t.getIdLot()).ifPresent(lot -> {
            StatutLot ancienStatut = lot.getStatutLot();
            if (lot.getQuantiteNette() == null || lot.getQuantiteNette().compareTo(BigDecimal.ZERO) <= 0) {
                lot.setStatutLot(StatutLot.TRANSFERE);
                lotRepo.save(lot);
                historiqueRepo.save(HistoriqueStatutLot.of(
                    lot.getId(), ancienStatut, StatutLot.TRANSFERE, username,
                    "Lot épuisé — transfert " + t.getCodeTransfert() + " accepté ("
                    + t.getQuantite() + " kg)"));
            }
            // Transfert partiel : quantiteNette > 0 → statut inchangé, lot reste visible dans le catalogue
        });

        TransfertLot saved = transfertRepo.save(t);

        // Publication immédiate lot.stock.sync si siteCode fourni (FIFO : crédit au site destinataire)
        if (siteCode != null && !siteCode.isBlank() && saved.getQuantite() != null) {
            try {
                String syncPayload = om.writeValueAsString(Map.of(
                    "idLot",    saved.getIdLot(),
                    "codeSite", siteCode,
                    "quantite", saved.getQuantite(),
                    "unite",    "kg"
                ));
                producer.lotStockSync(syncPayload);
            } catch (Exception e) {
                log.warn("Stock sync non publié pour acceptation transfert {} : {}",
                         saved.getCodeTransfert(), e.getMessage());
            }
        }

        // Outbox Transactional Outbox → lot.transfer.accepte (débit site source + crédit fallback)
        try {
            Map<String, Object> payloadMap = new java.util.LinkedHashMap<>();
            payloadMap.put("idTransfertLot",   saved.getId());
            payloadMap.put("codeTransfert",    saved.getCodeTransfert());
            payloadMap.put("idLot",            saved.getIdLot());
            payloadMap.put("quantite",         saved.getQuantite());
            payloadMap.put("unite",            "kg");
            payloadMap.put("roleEmetteur",     saved.getRoleEmetteur());
            payloadMap.put("roleDestinataire", saved.getRoleDestinataire());
            if (siteCode != null && !siteCode.isBlank()) {
                payloadMap.put("siteCode", siteCode);
            }
            OutboxEvent event = new OutboxEvent();
            event.setAggregateType("TransfertLot");
            event.setAggregateId(saved.getId().toString());
            event.setType("LOT_TRANSFER_ACCEPTE");
            event.setPayload(om.writeValueAsString(payloadMap));
            outboxRepo.save(event);
        } catch (Exception e) {
            log.error("Outbox non enregistré pour transfert lot {} : {}",
                      saved.getCodeTransfert(), e.getMessage());
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
