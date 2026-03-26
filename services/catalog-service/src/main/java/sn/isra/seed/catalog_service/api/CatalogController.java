package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

  private final EspeceRepo especeRepo;
  private final VarieteRepo varieteRepo;

  // ── Espèces ──────────────────────────────────────────────
  @GetMapping("/species")
  public List<Espece> species() {
    return especeRepo.findAll();
  }

  @PostMapping("/species")
  public Espece createSpecies(@RequestBody Espece e) {
    return especeRepo.save(e);
  }

  @GetMapping("/species/{id}")
  public ResponseEntity<Espece> getSpecies(@PathVariable Long id) {
    return especeRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // ── Variétés ─────────────────────────────────────────────
  @GetMapping("/varieties")
  public List<Variete> varieties(
      @RequestParam(required=false) Long especeId,
      @RequestParam(required=false) String statut) {
    if (especeId != null) return varieteRepo.findByEspece_Id(especeId);
    if (statut != null) return varieteRepo.findByStatutVariete(statut);
    return varieteRepo.findAll();
  }

  @GetMapping("/varieties/{id}")
  public ResponseEntity<Variete> getVariete(@PathVariable Long id) {
    return varieteRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping("/varieties")
  public Variete createVariety(@RequestBody Variete v) {
    return varieteRepo.save(v);
  }

  @PatchMapping("/varieties/{id}/statut")
  public ResponseEntity<Variete> updateStatut(@PathVariable Long id,
                                               @RequestBody Map<String, String> body) {
    return varieteRepo.findById(id).map(v -> {
      v.setStatutVariete(body.get("statut"));
      return ResponseEntity.ok(varieteRepo.save(v));
    }).orElse(ResponseEntity.notFound().build());
  }

  /**
   * Archive une variété (soft-delete) : statut → ARCHIVEE + commentaire + date + auteur.
   * Réservé aux rôles seed-admin et seed-selector.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PatchMapping("/varieties/{id}/archive")
  public ResponseEntity<Variete> archiveVariete(
      @PathVariable Long id,
      @RequestBody Map<String, String> body,
      @AuthenticationPrincipal Jwt jwt) {

    String commentaire = body.get("commentaire");
    if (commentaire == null || commentaire.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un commentaire est obligatoire pour archiver une variété");

    return varieteRepo.findById(id).map(v -> {
      if ("ARCHIVEE".equals(v.getStatutVariete()))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette variété est déjà archivée");

      v.setStatutVariete("ARCHIVEE");
      v.setCommentaireArchivage(commentaire.trim());
      v.setDateArchivage(Instant.now());
      v.setArchivePar(jwt != null ? jwt.getClaimAsString("preferred_username") : "inconnu");
      return ResponseEntity.ok(varieteRepo.save(v));
    }).orElse(ResponseEntity.notFound().build());
  }

  /**
   * Suppression définitive — uniquement si la variété est déjà ARCHIVEE.
   * Réservé aux rôles seed-admin et seed-selector.
   */
  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @DeleteMapping("/varieties/{id}")
  public ResponseEntity<Void> deleteVariete(
      @PathVariable Long id,
      @RequestBody(required=false) Map<String, String> body) {

    Variete v = varieteRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

    if (!"ARCHIVEE".equals(v.getStatutVariete()))
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seules les variétés archivées peuvent être supprimées définitivement");

    varieteRepo.delete(v);
    return ResponseEntity.noContent().build();
  }
}
