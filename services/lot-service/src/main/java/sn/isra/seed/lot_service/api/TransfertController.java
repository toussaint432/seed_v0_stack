package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.entity.enums.StatutTransfert;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.StockCreditRepo;
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

    private final TransfertLotRepo       transfertRepo;
    private final LotRepo                lotRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final StockCreditRepo         stockCreditRepo;

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
     * Body JSON (optionnel) : { "siteCode": "FERME-MULTI-02" }
     *
     * Crédite le stock du destinataire de manière synchrone et atomique (pas de Kafka).
     * Résolution du site : siteCode du body → sinon, site principal de l'org du destinataire.
     * Marque également la commande associée comme LIVREE.
     *
     * Note : la quantiteNette du lot source est déjà déduite lors de l'initiation du
     * transfert (LotController.transfer) — aucune déduction supplémentaire ici.
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

        // 1. Marquer le transfert ACCEPTE
        t.setStatut(StatutTransfert.ACCEPTE);
        t.setDateAcceptation(LocalDate.now());

        // 2. Mise à jour statut lot source si épuisé (transfert partiel : statut inchangé)
        Long sourceLotId = t.getIdLot();
        lotRepo.findById(sourceLotId).ifPresent(lot -> {
            StatutLot ancienStatut = lot.getStatutLot();
            if (lot.getQuantiteNette() == null || lot.getQuantiteNette().compareTo(BigDecimal.ZERO) <= 0) {
                lot.setStatutLot(StatutLot.TRANSFERE);
                lotRepo.save(lot);
                historiqueRepo.save(HistoriqueStatutLot.of(
                    lot.getId(), ancienStatut, StatutLot.TRANSFERE, username,
                    "Lot épuisé — transfert " + t.getCodeTransfert() + " accepté ("
                    + t.getQuantite() + " kg)"));
            }
        });

        // 3. Si ce transfert provient d'une commande (order-service), créer un lot REC
        //    pour que le multiplicateur possède son propre lot (idOrgProducteur = lui-même)
        //    et non le lot UPSemCL source dans "Mes Lots".
        stockCreditRepo.findCommandeByTransfert(t.getCodeTransfert()).ifPresent(info -> {
            try {
                String codeLot = "REC-" + info.commandeId() + "-L" + info.ligneId();
                Long newLotId = stockCreditRepo.createReceptionLot(
                    sourceLotId, codeLot,
                    info.idOrgAcheteur(), info.usernameAcheteur(),
                    t.getQuantite(), "kg"
                );
                t.setIdLot(newLotId);
                log.info("Lot REC {} (id={}) créé pour commande #{} — transfert {} redirigé",
                    codeLot, newLotId, info.commandeId(), t.getCodeTransfert());
            } catch (Exception e) {
                log.error("Impossible de créer le lot REC pour transfert {} : {}",
                    t.getCodeTransfert(), e.getMessage());
            }
        });

        TransfertLot saved = transfertRepo.save(t);

        // 4. Résoudre le site de stockage du destinataire
        String siteCode = (body != null) ? (String) body.get("siteCode") : null;
        if ((siteCode == null || siteCode.isBlank()) && saved.getUsernameDestinataire() != null) {
            siteCode = stockCreditRepo
                .findOrgIdByUsername(saved.getUsernameDestinataire())
                .flatMap(stockCreditRepo::findPrimarySiteByOrgId)
                .orElse(null);
        }

        // 5. Crédit stock pour le lot REC (si commande) ou le lot source (sinon)
        if (siteCode != null && !siteCode.isBlank() && saved.getQuantite() != null) {
            boolean ok = stockCreditRepo.crediterSite(saved.getIdLot(), siteCode, saved.getQuantite());
            if (ok) {
                log.info("Stock crédité : lot={} site={} qte={} kg (transfert {})",
                         saved.getIdLot(), siteCode, saved.getQuantite(), saved.getCodeTransfert());
            } else {
                log.error("Échec crédit stock — lot={} site={} (transfert {})",
                          saved.getIdLot(), siteCode, saved.getCodeTransfert());
            }
        } else {
            log.warn("Site destinataire introuvable pour transfert {} (destinataire={})",
                     saved.getCodeTransfert(), saved.getUsernameDestinataire());
        }

        // 6. Passer la commande associée à LIVREE
        stockCreditRepo.marquerCommandeLivree(saved.getCodeTransfert());

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
