package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.EspeceHistorique;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.VarieteHistorique;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
import sn.isra.seed.catalog_service.repo.EspeceHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CatalogController {

  private final EspeceRepo             especeRepo;
  private final EspeceHistoriqueRepo   especeHistoriqueRepo;
  private final VarieteRepo            varieteRepo;
  private final VarieteHistoriqueRepo  historiqueRepo;

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
    Espece saved = especeRepo.save(e);
    String user  = jwt != null ? jwt.getClaimAsString("preferred_username") : "inconnu";
    especeHistoriqueRepo.save(new EspeceHistorique(saved.getId(), "CREATION",
        "codeEspece", null, saved.getCodeEspece(), user));
    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
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
  public List<Variete> varieties(
      @RequestParam(required = false) Long especeId,
      @RequestParam(required = false) String statut) {
    if (especeId != null) return varieteRepo.findByEspece_IdOrderByNomVarieteAsc(especeId);
    if (statut != null) {
      try {
        return varieteRepo.findByStatutVarieteOrderByNomVarieteAsc(StatutVariete.valueOf(statut.toUpperCase()));
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Statut invalide : " + statut + ". Valeurs acceptées : DIFFUSEE, EN_TEST, RETIREE, ARCHIVEE");
      }
    }
    return varieteRepo.findAllByOrderByNomVarieteAsc();
  }

  @GetMapping("/varieties/{id}")
  public ResponseEntity<Variete> getVariete(@PathVariable Long id) {
    return varieteRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @PostMapping("/varieties")
  public ResponseEntity<Variete> createVariety(@Valid @RequestBody Variete v) {
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
  public ResponseEntity<Variete> updateVariete(
      @PathVariable Long id,
      @Valid @RequestBody Variete body,
      @AuthenticationPrincipal Jwt jwt) {

    return varieteRepo.findById(id).map(v -> {
      String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "inconnu";
      List<VarieteHistorique> changes = new ArrayList<>();

      trackStr(changes, v.getId(), "Nom variété",             v.getNomVariete(),                     body.getNomVariete(),                    user);
      trackStr(changes, v.getId(), "Origine",                 v.getOrigine(),                        body.getOrigine(),                       user);
      trackStr(changes, v.getId(), "Sélectionneur principal", v.getSelectionneurPrincipal(),         body.getSelectionneurPrincipal(),        user);
      trackStr(changes, v.getId(), "Année d'obtention",       str(v.getAnneeCreation()),             str(body.getAnneeCreation()),            user);
      trackStr(changes, v.getId(), "Cycle min (j)",           str(v.getCycleMin()),                  str(body.getCycleMin()),                 user);
      trackStr(changes, v.getId(), "Cycle max (j)",           str(v.getCycleMax()),                  str(body.getCycleMax()),                 user);
      trackStr(changes, v.getId(), "Statut",                  str(v.getStatutVariete()),             str(body.getStatutVariete()),            user);
      trackStr(changes, v.getId(), "Pedigree",                v.getPedigree(),                       body.getPedigree(),                      user);
      trackStr(changes, v.getId(), "Type de grain",           v.getTypeGrain(),                      body.getTypeGrain(),                     user);
      trackStr(changes, v.getId(), "Rendement min (t/ha)",    str(v.getRendementMin()),              str(body.getRendementMin()),             user);
      trackStr(changes, v.getId(), "Rendement max (t/ha)",    str(v.getRendementMax()),              str(body.getRendementMax()),             user);

      if (body.getNomVariete()             != null) v.setNomVariete(body.getNomVariete());
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

      Variete saved = varieteRepo.save(v);
      if (!changes.isEmpty()) historiqueRepo.saveAll(changes);
      return ResponseEntity.ok(saved);
    }).orElse(ResponseEntity.notFound().build());
  }

  @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
  @GetMapping("/varieties/{id}/historique")
  public List<VarieteHistorique> getHistorique(@PathVariable Long id) {
    if (!varieteRepo.existsById(id))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable");
    return historiqueRepo.findByIdVarieteOrderByDateModificationDesc(id);
  }

  // ── Helpers traçabilité ───────────────────────────────────────────────────

  private void trackStr(List<VarieteHistorique> list, Long idVariete,
                        String champ, String ancienne, String nouvelle, String user) {
    if (nouvelle == null) return;
    if (Objects.equals(ancienne, nouvelle)) return;
    list.add(new VarieteHistorique(idVariete, champ, ancienne, nouvelle, user));
  }

  private static String str(Object o) {
    return o == null ? null : o.toString();
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

    long nbLots = varieteRepo.countLotsParVariete(id);
    long nbCommandes = varieteRepo.countCommandesParVariete(id);
    if (nbLots > 0 || nbCommandes > 0) {
      StringBuilder msg = new StringBuilder(
          "Impossible de supprimer cette variété : elle est encore référencée par ");
      if (nbLots > 0) msg.append(nbLots).append(" lot(s) semencier(s)");
      if (nbLots > 0 && nbCommandes > 0) msg.append(" et ");
      if (nbCommandes > 0) msg.append(nbCommandes).append(" ligne(s) de commande");
      msg.append(". Supprimez ou réaffectez ces éléments avant de procéder.");
      throw new ResponseStatusException(HttpStatus.CONFLICT, msg.toString());
    }

    varieteRepo.delete(v);
    return ResponseEntity.noContent().build();
  }
}
