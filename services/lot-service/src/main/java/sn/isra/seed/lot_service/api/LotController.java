package sn.isra.seed.lot_service.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.common.util.JwtHelper;
import sn.isra.seed.lot_service.api.dto.CreateChildLotRequest;
import sn.isra.seed.lot_service.api.dto.LineageNode;
import sn.isra.seed.lot_service.api.dto.LotGenStatsDto;
import sn.isra.seed.lot_service.api.dto.LotSemencierDto;
import sn.isra.seed.lot_service.api.dto.UpdateLotRequest;
import sn.isra.seed.lot_service.entity.LotAuditLog;
import sn.isra.seed.lot_service.entity.enums.StatutEdition;
import sn.isra.seed.lot_service.repo.LotAuditLogRepo;
import sn.isra.seed.lot_service.api.mapper.LotMapper;
import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.MembreOrgLotRepo;
import sn.isra.seed.lot_service.service.LotService;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotRepo                 lotRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final LotService              lotService;
    private final LotMapper               lotMapper;
    private final MembreOrgLotRepo        membreOrgLotRepo;
    private final LotAuditLogRepo         auditLogRepo;

    @GetMapping("/alerts/count")
    public Map<String, Long> alertsCount(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return Map.of("count", 0L);
        String username = jwt.getClaimAsString("preferred_username");
        Instant limite48h = Instant.now().minus(48, ChronoUnit.HOURS);
        long count = 0;
        if (JwtHelper.hasRole(jwt, "seed-selector")) {
            count = lotRepo.countBrouillonsForUser(username, limite48h);
        } else if (JwtHelper.hasRole(jwt, "seed-multiplicator")) {
            Long orgId = membreOrgLotRepo.findOrgIdByUsername(username).orElse(null);
            count = (orgId != null ? lotRepo.countBrouillonsForOrg(orgId, limite48h) : 0)
                  + lotRepo.countRejetesForUser(username);
        } else if (JwtHelper.hasRole(jwt, "seed-upsemcl")) {
            Long orgId = membreOrgLotRepo.findOrgIdByUsername(username).orElse(null);
            count = (orgId != null ? lotRepo.countBrouillonsForOrg(orgId, limite48h) : 0)
                  + lotRepo.countLotsACertifier();
        } else if (JwtHelper.hasRole(jwt, "seed-admin") || JwtHelper.hasRole(jwt, "seed-directeur")) {
            count = lotRepo.countAllBrouillons(limite48h) + lotRepo.countLotsACertifier();
        }
        return Map.of("count", count);
    }

    @GetMapping
    public Page<LotSemencierDto> list(
            @RequestParam(required = false) String generation,
            @RequestParam(required = false) Long idVariete,
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return lotService.list(generation, idVariete, jwt, pageable).map(lotMapper::toDto);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LotSemencierDto> getById(@PathVariable Long id) {
        return lotRepo.findById(id)
                .map(lot -> ResponseEntity.ok(lotMapper.toDto(lot)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LotSemencierDto create(@Valid @RequestBody LotSemencier lot,
                                   @RequestParam(required = false) String siteCode,
                                   @AuthenticationPrincipal Jwt jwt) throws Exception {
        return lotMapper.toDto(lotService.create(lot, siteCode, jwt));
    }

    @PostMapping("/{id}/child")
    public LotSemencierDto createChild(@PathVariable Long id,
                                        @Valid @RequestBody CreateChildLotRequest req,
                                        @AuthenticationPrincipal Jwt jwt) throws Exception {
        return lotMapper.toDto(lotService.createChild(id, req, jwt));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @PatchMapping("/{id}/statut")
    public ResponseEntity<LotSemencierDto> updateStatut(@PathVariable Long id,
                                                         @RequestBody Map<String, String> body,
                                                         @AuthenticationPrincipal Jwt jwt) {
        String statutStr = body.get("statut");
        if (statutStr == null || statutStr.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'statut' est obligatoire");
        StatutLot nouveauStatut;
        try {
            nouveauStatut = StatutLot.valueOf(statutStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide : " + statutStr);
        }
        List<String> roles = JwtHelper.extractRoles(jwt);
        boolean isAdmin = roles.contains("seed-admin");
        String username = JwtHelper.getUsername(jwt);
        return lotRepo.findById(id).map(lot -> {
            if (!isAdmin && !username.equals(lot.getUsernameCreateur()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez modifier que vos propres lots");
            StatutLot ancienStatut = lot.getStatutLot();
            lot.setStatutLot(nouveauStatut);
            LotSemencierDto saved = lotMapper.toDto(lotRepo.save(lot));
            if (ancienStatut != nouveauStatut)
                historiqueRepo.save(HistoriqueStatutLot.of(lot.getId(), ancienStatut, nouveauStatut, username, "mise à jour manuelle"));
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/transfer")
    public ResponseEntity<TransfertLot> transfer(@PathVariable Long id,
                                                   @RequestBody Map<String, Object> body,
                                                   @AuthenticationPrincipal Jwt jwt) {
        String usernameDestinataire = (String) body.get("usernameDestinataire");
        String roleDestinataire     = (String) body.get("roleDestinataire");
        String observations         = (String) body.getOrDefault("observations", "");
        Object qte                  = body.get("quantite");
        BigDecimal quantiteTransfert = (qte instanceof Number)
            ? new BigDecimal(qte.toString()) : null;

        TransfertLot saved = lotService.transfer(id, usernameDestinataire, roleDestinataire,
            observations, quantiteTransfert, jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/{id}/lineage")
    public ResponseEntity<List<LineageNode>> lineage(@PathVariable Long id) {
        List<LineageNode> chain = new ArrayList<>();
        lotRepo.findById(id).ifPresent(lot -> {
            LotSemencier current = lot;
            while (current != null) {
                String nomOrg = current.getIdOrgProducteur() != null
                    ? membreOrgLotRepo.findOrgNomById(current.getIdOrgProducteur()).orElse(null)
                    : null;
                chain.add(0, LineageNode.from(current, nomOrg));
                current = current.getLotParent();
            }
        });
        return chain.isEmpty()
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(chain);
    }

    @GetMapping("/stats")
    public List<LotGenStatsDto> stats(@AuthenticationPrincipal Jwt jwt) {
        List<String> roles = JwtHelper.extractRoles(jwt);
        boolean isGlobal = roles.contains("seed-admin") || roles.contains("seed-directeur");
        List<Object[]> rows;
        if (isGlobal) {
            rows = lotRepo.statsParGeneration();
        } else if (roles.contains("seed-selector")) {
            String username = JwtHelper.getUsername(jwt);
            rows = username != null ? lotRepo.statsParGenerationForUser(username) : List.of();
        } else {
            Long orgId = lotService.resolveOrgId(jwt);
            rows = orgId != null ? lotRepo.statsParGenerationForOrg(orgId) : List.of();
        }
        return rows.stream()
            .map(row -> new LotGenStatsDto(
                (String) row[0],
                ((Number) row[1]).longValue(),
                ((Number) row[2]).doubleValue()
            ))
            .toList();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl','ROLE_seed-multiplicator','ROLE_seed-directeur')")
    @GetMapping("/catalogue-g3")
    public List<LotSemencierDto> catalogueG3() {
        return lotMapper.toDtoList(lotRepo.findCatalogueG3(StatutLot.DISPONIBLE));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl','ROLE_seed-selector','ROLE_seed-directeur')")
    @GetMapping("/catalogue-g1")
    public List<LotSemencierDto> catalogueG1() {
        return lotMapper.toDtoList(lotRepo.findCatalogueG1(StatutLot.DISPONIBLE));
    }

    @GetMapping("/mes-lots")
    public ResponseEntity<List<LotSemencierDto>> mesLots(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(401).build();
        String username = JwtHelper.getUsername(jwt);
        if (username == null) return ResponseEntity.ok(List.of());
        List<String> roles = JwtHelper.extractRoles(jwt);
        if (roles.contains("seed-selector")) {
            String spec = jwt.getClaimAsString("specialisation");
            if (spec != null) spec = spec.toUpperCase();
            return ResponseEntity.ok(lotMapper.toDtoList(lotRepo.findForSelector(username, spec)));
        }
        Long orgId = lotService.resolveOrgId(jwt);
        if (orgId == null) return ResponseEntity.ok(List.of());
        if (roles.contains("seed-upsemcl"))
            return ResponseEntity.ok(lotMapper.toDtoList(lotRepo.findLotsUpsemclAll(orgId)));
        return ResponseEntity.ok(lotMapper.toDtoList(lotRepo.findMesLots(orgId, username)));
    }

    // ── Édition d'un lot (BROUILLON uniquement) ───────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<LotSemencierDto> update(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateLotRequest req,
                                                   @AuthenticationPrincipal Jwt jwt) {
        String username = JwtHelper.getUsername(jwt);
        List<String> roles = JwtHelper.extractRoles(jwt);
        boolean isAdmin = roles.contains("seed-admin");

        return lotRepo.findById(id).map(lot -> {
            if (lot.getStatutEdition() == StatutEdition.CONFIRME)
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Ce lot est verrouillé — les données ont été confirmées et ne sont plus modifiables");
            if (!isAdmin && !username.equals(lot.getUsernameCreateur()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Vous ne pouvez modifier que vos propres lots");

            // Enregistrement des modifications champ par champ
            logIfChanged(auditLogRepo, lot.getId(), username,
                "campagne",              lot.getCampagne(),                     req.getCampagne());
            logIfChanged(auditLogRepo, lot.getId(), username,
                "dateProduction",        str(lot.getDateProduction()),           str(req.getDateProduction()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "quantiteNette",         str(lot.getQuantiteNette()),            str(req.getQuantiteNette()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "unite",                 lot.getUnite(),                         req.getUnite());
            logIfChanged(auditLogRepo, lot.getId(), username,
                "tauxGermination",       str(lot.getTauxGermination()),          str(req.getTauxGermination()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "puretePhysique",        str(lot.getPuretePhysique()),           str(req.getPuretePhysique()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "superficieHa",          str(lot.getSuperficieHa()),             str(req.getSuperficieHa()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "productionBruteKg",     str(lot.getProductionBruteKg()),        str(req.getProductionBruteKg()));
            logIfChanged(auditLogRepo, lot.getId(), username,
                "niveauSemence",         lot.getNiveauSemence(),                 req.getNiveauSemence());
            logIfChanged(auditLogRepo, lot.getId(), username,
                "quantiteSemenceSrcKg",  str(lot.getQuantiteSemenceSrcKg()),     str(req.getQuantiteSemenceSrcKg()));

            // Application des nouvelles valeurs (null = non modifié)
            if (req.getCampagne()             != null) lot.setCampagne(req.getCampagne());
            if (req.getDateProduction()       != null) lot.setDateProduction(req.getDateProduction());
            if (req.getQuantiteNette()        != null) lot.setQuantiteNette(req.getQuantiteNette());
            if (req.getUnite()                != null) lot.setUnite(req.getUnite());
            if (req.getTauxGermination()      != null) lot.setTauxGermination(req.getTauxGermination());
            if (req.getPuretePhysique()       != null) lot.setPuretePhysique(req.getPuretePhysique());
            if (req.getSuperficieHa()         != null) lot.setSuperficieHa(req.getSuperficieHa());
            if (req.getProductionBruteKg()    != null) lot.setProductionBruteKg(req.getProductionBruteKg());
            if (req.getNiveauSemence()        != null) lot.setNiveauSemence(req.getNiveauSemence());
            if (req.getQuantiteSemenceSrcKg() != null) lot.setQuantiteSemenceSrcKg(req.getQuantiteSemenceSrcKg());

            return ResponseEntity.ok(lotMapper.toDto(lotRepo.save(lot)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Suppression d'un lot (BROUILLON uniquement, créateur ou admin) ───────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                        @AuthenticationPrincipal Jwt jwt) {
        String username = JwtHelper.getUsername(jwt);
        List<String> roles = JwtHelper.extractRoles(jwt);
        boolean isAdmin = roles.contains("seed-admin");

        return lotRepo.findById(id).map(lot -> {
            if (lot.getStatutEdition() == StatutEdition.CONFIRME)
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Ce lot est verrouillé — impossible de le supprimer");
            if (!isAdmin && !username.equals(lot.getUsernameCreateur()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Vous ne pouvez supprimer que vos propres lots");

            auditLogRepo.save(LotAuditLog.suppression(lot.getId(), username));
            lotRepo.delete(lot);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Confirmation volontaire (UPSemCL / Sélectionneur) ────────────────────────

    @PostMapping("/{id}/confirmer")
    public ResponseEntity<LotSemencierDto> confirmer(@PathVariable Long id,
                                                      @AuthenticationPrincipal Jwt jwt) {
        String username = JwtHelper.getUsername(jwt);
        List<String> roles = JwtHelper.extractRoles(jwt);
        boolean isAdmin = roles.contains("seed-admin");

        return lotRepo.findById(id).map(lot -> {
            if (lot.getStatutEdition() == StatutEdition.CONFIRME)
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce lot est déjà verrouillé");
            if (!isAdmin && !username.equals(lot.getUsernameCreateur()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Vous ne pouvez confirmer que vos propres lots");

            lot.setStatutEdition(StatutEdition.CONFIRME);
            lot.setDateConfirmation(Instant.now());
            auditLogRepo.save(LotAuditLog.confirmation(lot.getId(), username));
            return ResponseEntity.ok(lotMapper.toDto(lotRepo.save(lot)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Historique des modifications d'un lot ────────────────────────────────────

    @GetMapping("/{id}/audit")
    public ResponseEntity<List<LotAuditLog>> auditLog(@PathVariable Long id) {
        if (!lotRepo.existsById(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(auditLogRepo.findByLotIdOrderByCreatedAtDesc(id));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static String str(Object o) { return o == null ? null : o.toString(); }

    private static void logIfChanged(LotAuditLogRepo repo, Long lotId, String username,
                                      String champ, String ancien, String nouveau) {
        if (!Objects.equals(ancien, nouveau))
            repo.save(LotAuditLog.modification(lotId, username, champ, ancien, nouveau));
    }
}
