package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
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

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
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
      @RequestParam(required = false) Long especeId,
      @RequestParam(required = false) String statut) {
    if (especeId != null) return varieteRepo.findByEspece_Id(especeId);
    if (statut != null) {
      try {
        return varieteRepo.findByStatutVariete(StatutVariete.valueOf(statut.toUpperCase()));
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Statut invalide : " + statut + ". Valeurs acceptées : DIFFUSEE, EN_TEST, RETIREE, ARCHIVEE");
      }
    }
    return varieteRepo.findAll();
  }

  @GetMapping("/varieties/{id}")
  public ResponseEntity<Variete> getVariete(@PathVariable Long id) {
    return varieteRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PostMapping("/varieties")
  public ResponseEntity<Variete> createVariety(@RequestBody Variete v) {
    if (v.getEspece() == null || v.getEspece().getId() == null)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'espece.id' est obligatoire");
    Espece espece = especeRepo.findById(v.getEspece().getId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Espèce introuvable : id=" + v.getEspece().getId()));
    v.setEspece(espece);
    return ResponseEntity.status(HttpStatus.CREATED).body(varieteRepo.save(v));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PutMapping("/varieties/{id}")
  public ResponseEntity<Variete> updateVariete(@PathVariable Long id,
                                                @RequestBody Variete body) {
    return varieteRepo.findById(id).map(v -> {
      if (body.getNomVariete() != null) v.setNomVariete(body.getNomVariete());
      if (body.getEspece() != null && body.getEspece().getId() != null)
        especeRepo.findById(body.getEspece().getId()).ifPresent(v::setEspece);
      if (body.getOrigine()                != null) v.setOrigine(body.getOrigine());
      if (body.getSelectionneurPrincipal() != null) v.setSelectionneurPrincipal(body.getSelectionneurPrincipal());
      if (body.getAnneeCreation()          != null) v.setAnneeCreation(body.getAnneeCreation());
      if (body.getCycleMin()               != null) v.setCycleMin(body.getCycleMin());
      if (body.getCycleMax()               != null) v.setCycleMax(body.getCycleMax());
      if (body.getStatutVariete()          != null) v.setStatutVariete(body.getStatutVariete());
      if (body.getPedigree()               != null) v.setPedigree(body.getPedigree());
      if (body.getTypeGrain()              != null) v.setTypeGrain(body.getTypeGrain());
      if (body.getRendementMin()           != null) v.setRendementMin(body.getRendementMin());
      if (body.getRendementMax()           != null) v.setRendementMax(body.getRendementMax());
      return ResponseEntity.ok(varieteRepo.save(v));
    }).orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PatchMapping("/varieties/{id}/statut")
  public ResponseEntity<Variete> updateStatut(@PathVariable Long id,
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
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Un commentaire est obligatoire pour archiver une variété");

    return varieteRepo.findById(id).map(v -> {
      if (StatutVariete.ARCHIVEE == v.getStatutVariete())
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette variété est déjà archivée");

      v.setStatutVariete(StatutVariete.ARCHIVEE);
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
      @RequestBody(required = false) Map<String, String> body) {

    Variete v = varieteRepo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

    if (StatutVariete.ARCHIVEE != v.getStatutVariete())
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Seules les variétés archivées peuvent être supprimées définitivement");

    varieteRepo.delete(v);
    return ResponseEntity.noContent().build();
  }
}
