package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutTransfert;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transferts")
@RequiredArgsConstructor
public class TransfertController {

    private final TransfertLotRepo transfertRepo;
    private final LotRepo lotRepo;

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
    @PutMapping("/{id}/accepter")
    public ResponseEntity<?> accepter(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        return transfertRepo.findById(id).map(t -> {
            if (!t.getUsernameDestinataire().equals(username))
                return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));
            if (StatutTransfert.EN_ATTENTE != t.getStatut())
                return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

            t.setStatut(StatutTransfert.ACCEPTE);
            t.setDateAcceptation(LocalDate.now());
            // Marquer le lot comme transféré
            lotRepo.findById(t.getIdLot()).ifPresent(lot -> {
                lot.setStatutLot(StatutLot.TRANSFERE);
                lotRepo.save(lot);
            });
            return ResponseEntity.<Object>ok(transfertRepo.save(t));
        }).orElse(ResponseEntity.notFound().build());
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
