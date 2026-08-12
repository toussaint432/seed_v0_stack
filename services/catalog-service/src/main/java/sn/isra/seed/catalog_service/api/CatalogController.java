package sn.isra.seed.catalog_service.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.catalog_service.api.dto.VarieteDto;
import sn.isra.seed.catalog_service.api.mapper.VarieteMapper;
import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.EspeceHistorique;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.VarieteHistorique;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
import sn.isra.seed.catalog_service.repo.EspeceHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import sn.isra.seed.catalog_service.service.CatalogService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

  private final EspeceRepo            especeRepo;
  private final EspeceHistoriqueRepo  especeHistoriqueRepo;
  private final VarieteRepo           varieteRepo;
  private final VarieteHistoriqueRepo historiqueRepo;
  private final CatalogService        catalogService;
  private final VarieteMapper         varieteMapper;

  // ── Espèces ──────────────────────────────────────────────

  @GetMapping("/species")
  public List<Espece> species() {
    return especeRepo.findAllByOrderByNomCommunAsc();
  }

  @PreAuthorize("hasAuthority('ROLE_seed-admin')")
  @PostMapping("/species")
  public ResponseEntity<Espece> createSpecies(
      @Valid @RequestBody Espece e,
      @AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createSpecies(e, jwt));
  }

  @PreAuthorize("hasAuthority('ROLE_seed-admin')")
  @GetMapping("/species/{id}/historique")
  public List<EspeceHistorique> getEspeceHistorique(@PathVariable Long id) {
    if (!especeRepo.existsById(id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Espèce introuvable");
    return especeHistoriqueRepo.findByIdEspeceOrderByDateModificationDesc(id);
  }

  @GetMapping("/species/{id}")
  public ResponseEntity<Espece> getSpecies(@PathVariable Long id) {
    return especeRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // ── Variétés ─────────────────────────────────────────────

  @GetMapping("/varieties")
  public List<VarieteDto> varieties(
      @RequestParam(required = false) Long especeId,
      @RequestParam(required = false) String statut) {
    if (especeId != null)
      return varieteRepo.findByEspece_IdOrderByNomVarieteAsc(especeId).stream().map(varieteMapper::toDto).toList();
    if (statut != null) {
      try {
        return varieteRepo.findByStatutVarieteOrderByNomVarieteAsc(
            StatutVariete.valueOf(statut.toUpperCase())).stream().map(varieteMapper::toDto).toList();
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Statut invalide : " + statut + ". Valeurs acceptées : DIFFUSEE, EN_TEST, RETIREE, ARCHIVEE");
      }
    }
    return varieteRepo.findAllByOrderByNomVarieteAsc().stream().map(varieteMapper::toDto).toList();
  }

  @GetMapping("/varieties/{id}")
  public ResponseEntity<VarieteDto> getVariete(@PathVariable Long id) {
    return varieteRepo.findById(id)
        .map(v -> ResponseEntity.ok(varieteMapper.toDto(v)))
        .orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PostMapping("/varieties")
  public ResponseEntity<VarieteDto> createVariety(@Valid @RequestBody Variete v) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(varieteMapper.toDto(catalogService.createVariety(v)));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PutMapping("/varieties/{id}")
  public ResponseEntity<VarieteDto> updateVariete(
      @PathVariable Long id,
      @Valid @RequestBody Variete body,
      @AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok(varieteMapper.toDto(catalogService.updateVariete(id, body, jwt)));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @GetMapping("/varieties/{id}/historique")
  public List<VarieteHistorique> getHistorique(@PathVariable Long id) {
    if (!varieteRepo.existsById(id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable");
    return historiqueRepo.findByIdVarieteOrderByDateModificationDesc(id);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PatchMapping("/varieties/{id}/statut")
  public ResponseEntity<VarieteDto> updateStatut(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
    String statutStr = body.get("statut");
    if (statutStr == null || statutStr.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'statut' est obligatoire");
    StatutVariete nouveauStatut;
    try {
      nouveauStatut = StatutVariete.valueOf(statutStr.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Statut invalide : " + statutStr + ". Valeurs acceptées : DIFFUSEE, EN_TEST, RETIREE, ARCHIVEE");
    }
    return varieteRepo.findById(id).map(v -> {
      v.setStatutVariete(nouveauStatut);
      return ResponseEntity.ok(varieteMapper.toDto(varieteRepo.save(v)));
    }).orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PatchMapping("/varieties/{id}/archive")
  public ResponseEntity<VarieteDto> archiveVariete(
      @PathVariable Long id,
      @RequestBody Map<String, String> body,
      @AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok(varieteMapper.toDto(catalogService.archiveVariete(id, body.get("commentaire"), jwt)));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @DeleteMapping("/varieties/{id}")
  public ResponseEntity<Void> deleteVariete(@PathVariable Long id) {
    catalogService.deleteVariete(id);
    return ResponseEntity.noContent().build();
  }
}
