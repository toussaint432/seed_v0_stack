package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.enums.TypeSite;
import sn.isra.seed.stock_service.repo.MembreOrgStockRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sites")
@RequiredArgsConstructor
public class SiteController {

    private final SiteRepo          siteRepo;
    private final MembreOrgStockRepo membreRepo;

    /* ── GET /api/sites — tous les sites (admin / lecture publique) ── */
    @GetMapping
    public List<Site> list(
            @RequestParam(required = false) String region,
            @RequestParam(required = false) Long idOrganisation) {
        if (idOrganisation != null)
            return siteRepo.findByIdOrganisationOrderByEstPrincipalDescIdAsc(idOrganisation);
        return siteRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Site> getById(@PathVariable Long id) {
        return siteRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* ── GET /api/sites/mes-sites — sites appartenant à l'org du connecté ── */
    @GetMapping("/mes-sites")
    public ResponseEntity<?> mesSites(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        var orgId = membreRepo.findOrgIdByUsername(username);
        if (orgId.isEmpty())
            return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(
            siteRepo.findByIdOrganisationOrderByEstPrincipalDescIdAsc(orgId.get())
        );
    }

    /**
     * POST /api/sites/mes-sites
     * Crée un site pour l'organisation du connecté (multiplicateur ou quotataire).
     * Le code est auto-généré : SITE-{CODE_ORG}-{N:02d}
     * Body : { nomSite, typeSite, departement, localite, region, latitude, longitude }
     */
    @PostMapping("/mes-sites")
    public ResponseEntity<?> creerMonSite(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var orgIdOpt = membreRepo.findOrgIdByUsername(username);
        if (orgIdOpt.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("message", "Organisation introuvable pour cet utilisateur"));

        Long   orgId   = orgIdOpt.get();
        String orgCode = membreRepo.findOrgCodeById(orgId).orElse("SITE");

        // Générer code unique SITE-{ORG_CODE}-{N:02d}
        List<Site> existing = siteRepo.findByIdOrganisationOrderByEstPrincipalDescIdAsc(orgId);
        String codeSite;
        int n = existing.size() + 1;
        do {
            codeSite = String.format("SITE-%s-%02d", orgCode, n++);
        } while (siteRepo.existsByCodeSite(codeSite));

        String nomSite = getString(body, "nomSite");
        if (nomSite == null || nomSite.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Le nom du site est obligatoire"));

        Site s = new Site();
        s.setCodeSite(codeSite);
        s.setNomSite(nomSite.trim());
        s.setTypeSite(parseType(body.getOrDefault("typeSite", "FERME").toString()));
        s.setDepartement(getString(body, "departement"));
        s.setLocalite(getString(body, "localite"));
        s.setRegion(getString(body, "region"));
        s.setLatitude(parseBD(body.get("latitude")));
        s.setLongitude(parseBD(body.get("longitude")));
        s.setIdOrganisation(orgId);
        // Premier site de l'org → principal par défaut
        s.setEstPrincipal(existing.isEmpty());

        return ResponseEntity.ok(siteRepo.save(s));
    }

    /**
     * PUT /api/sites/mes-sites/{code}
     * Modifie un site appartenant à l'org du connecté.
     * Body : { nomSite, typeSite, departement, localite, region, latitude, longitude }
     */
    @PutMapping("/mes-sites/{code}")
    public ResponseEntity<?> modifierMonSite(
            @PathVariable String code,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var orgIdOpt = membreRepo.findOrgIdByUsername(username);
        if (orgIdOpt.isEmpty())
            return ResponseEntity.status(403).body(Map.of("message", "Accès non autorisé"));

        return siteRepo.findByCodeSite(code).map(s -> {
            if (!orgIdOpt.get().equals(s.getIdOrganisation()))
                return ResponseEntity.status(403).<Object>body(Map.of("message", "Ce site n'appartient pas à votre organisation"));

            String nom = getString(body, "nomSite");
            if (nom != null && !nom.isBlank()) s.setNomSite(nom.trim());
            if (body.containsKey("typeSite"))   s.setTypeSite(parseType(body.get("typeSite").toString()));
            if (body.containsKey("departement")) s.setDepartement(getString(body, "departement"));
            if (body.containsKey("localite"))    s.setLocalite(getString(body, "localite"));
            if (body.containsKey("region"))      s.setRegion(getString(body, "region"));
            if (body.containsKey("latitude"))    s.setLatitude(parseBD(body.get("latitude")));
            if (body.containsKey("longitude"))   s.setLongitude(parseBD(body.get("longitude")));

            return ResponseEntity.<Object>ok(siteRepo.save(s));
        }).orElse(ResponseEntity.notFound().build());
    }

    /* ── Admin : CRUD complet ── */
    @PostMapping
    public Site create(@RequestBody Site site) {
        return siteRepo.save(site);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Site> update(@PathVariable Long id, @RequestBody Site body) {
        return siteRepo.findById(id).map(s -> {
            if (body.getCodeSite()  != null) s.setCodeSite(body.getCodeSite());
            if (body.getNomSite()   != null) s.setNomSite(body.getNomSite());
            if (body.getTypeSite()  != null) s.setTypeSite(body.getTypeSite());
            if (body.getLocalite()  != null) s.setLocalite(body.getLocalite());
            if (body.getDepartement()!= null) s.setDepartement(body.getDepartement());
            if (body.getRegion()    != null) s.setRegion(body.getRegion());
            if (body.getLatitude()  != null) s.setLatitude(body.getLatitude());
            if (body.getLongitude() != null) s.setLongitude(body.getLongitude());
            if (body.getIdOrganisation() != null) s.setIdOrganisation(body.getIdOrganisation());
            return ResponseEntity.ok(siteRepo.save(s));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!siteRepo.existsById(id)) return ResponseEntity.notFound().build();
        siteRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /* ── Helpers privés ── */
    private String getString(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v instanceof String s ? s.trim() : (v != null ? v.toString().trim() : null);
    }

    private BigDecimal parseBD(Object v) {
        if (v == null) return null;
        try { return new BigDecimal(v.toString()); } catch (Exception e) { return null; }
    }

    private TypeSite parseType(String v) {
        try { return TypeSite.valueOf(v.toUpperCase()); }
        catch (Exception e) { return TypeSite.FERME; }
    }
}
