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
import sn.isra.seed.lot_service.api.dto.LotSemencierDto;
import sn.isra.seed.lot_service.api.mapper.LotMapper;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.service.LotService;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotController {

    private final LotRepo                 lotRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final LotService              lotService;
    private final LotMapper               lotMapper;

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

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PatchMapping("/{id}/statut")
    public ResponseEntity<LotSemencierDto> updateStatut(@PathVariable Long id,
                                                         @RequestBody Map<String, String> body) {
        String statutStr = body.get("statut");
        if (statutStr == null || statutStr.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'statut' est obligatoire");
        StatutLot nouveauStatut;
        try {
            nouveauStatut = StatutLot.valueOf(statutStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide : " + statutStr);
        }
        return lotRepo.findById(id).map(lot -> {
            lot.setStatutLot(nouveauStatut);
            return ResponseEntity.ok(lotMapper.toDto(lotRepo.save(lot)));
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
                chain.add(0, LineageNode.from(current));
                current = current.getLotParent();
            }
        });
        return chain.isEmpty()
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(chain);
    }

    @GetMapping("/catalogue-g3")
    public List<LotSemencierDto> catalogueG3() {
        return lotMapper.toDtoList(lotRepo.findCatalogueG3(StatutLot.DISPONIBLE));
    }

    @GetMapping("/mes-lots")
    public ResponseEntity<List<LotSemencierDto>> mesLots(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(401).build();
        String username = JwtHelper.getUsername(jwt);
        if (username == null) return ResponseEntity.ok(List.of());
        Long orgId = lotService.resolveOrgId(jwt);
        if (orgId == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(lotMapper.toDtoList(lotRepo.findMesLots(orgId, username)));
    }
}
