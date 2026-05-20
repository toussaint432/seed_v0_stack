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

import java.util.List;

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
    // Pour UPSemCL : visibilité org-level (tous les transferts du rôle seed-upsemcl,
    // qu'ils soient reçus de Sélectionneur ou émis vers Multiplicateur).
    @GetMapping
    public List<TransfertLot> mesTransferts(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        List<String> roles = extractRealmRoles(jwt);
        if (roles.contains("seed-upsemcl"))
            return transfertRepo.findByRoleParticipant("seed-upsemcl");
        return transfertRepo.findByParticipant(username);
    }

    /* ── GET /api/transferts/recus — EN_ATTENTE pour le connecté ou l'org ── */
    @GetMapping("/recus")
    public List<TransfertLot> transfertsRecus(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        List<String> roles = extractRealmRoles(jwt);
        if (roles.contains("seed-upsemcl"))
            return transfertRepo.findPendingForRole("seed-upsemcl");
        return transfertRepo.findPendingForDestinataire(username);
    }

    /* ── PUT /api/transferts/{id}/accepter ─────────────────────── */
    @Transactional
    @PutMapping("/{id}/accepter")
    public ResponseEntity<?> accepter(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        List<String> roles = extractRealmRoles(jwt);
        TransfertLot t = transfertRepo.findById(id).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();

        // Autorisation : destinataire nommé OU tout agent du même rôle organisationnel
        boolean isDestinataire  = t.getUsernameDestinataire().equals(username);
        boolean sameOrgRole     = t.getRoleDestinataire() != null && roles.contains(t.getRoleDestinataire());
        if (!isDestinataire && !sameOrgRole)
            return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));

        if (StatutTransfert.EN_ATTENTE != t.getStatut())
            return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

        t.setStatut(StatutTransfert.ACCEPTE);
        t.setDateAcceptation(LocalDate.now());
        t.setAcceptedAt(java.time.Instant.now());

        // La quantite_nette a été réservée (déduite) dès l'initiation du transfert.
        // À l'acceptation : on s'assure que le statut est cohérent avec la quantité restante.
        lotRepo.findById(t.getIdLot()).ifPresent(lot -> {
            boolean lotEncore = lot.getQuantiteNette() != null
                    && lot.getQuantiteNette().compareTo(BigDecimal.ZERO) > 0;
            // Si le lot a encore du stock → il est toujours DISPONIBLE
            if (lotEncore) lot.setStatutLot(StatutLot.DISPONIBLE);
            // Sinon il reste TRANSFERE (défini à l'initiation)
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
        List<String> roles = extractRealmRoles(jwt);
        return transfertRepo.findById(id).map(t -> {
            boolean isDestinataire = t.getUsernameDestinataire().equals(username);
            boolean sameOrgRole    = t.getRoleDestinataire() != null && roles.contains(t.getRoleDestinataire());
            if (!isDestinataire && !sameOrgRole)
                return ResponseEntity.status(403).<Object>body(Map.of("message", "Non autorisé"));
            if (StatutTransfert.EN_ATTENTE != t.getStatut())
                return ResponseEntity.badRequest().<Object>body(Map.of("message", "Transfert déjà traité"));

            t.setStatut(StatutTransfert.REJETE);
            t.setMotifRefus(body.getOrDefault("motif", "Refusé par le destinataire"));
            t.setRefusedAt(java.time.Instant.now());
            TransfertLot saved = transfertRepo.save(t);
            // Restituer la quantité réservée au lot source
            lotRepo.findById(t.getIdLot()).ifPresent(lot -> {
                if (t.getQuantite() != null) {
                    BigDecimal avant = lot.getQuantiteNette() != null
                            ? lot.getQuantiteNette() : BigDecimal.ZERO;
                    lot.setQuantiteNette(avant.add(t.getQuantite()));
                }
                lot.setStatutLot(StatutLot.DISPONIBLE);
                lotRepo.save(lot);
            });
            return ResponseEntity.<Object>ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @SuppressWarnings("unchecked")
    private List<String> extractRealmRoles(Jwt jwt) {
        java.util.Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return List.of();
        Object roles = realmAccess.get("roles");
        if (roles instanceof List<?>) return (List<String>) roles;
        return List.of();
    }
}
