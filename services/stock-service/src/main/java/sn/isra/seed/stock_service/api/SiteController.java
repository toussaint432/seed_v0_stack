package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.entity.enums.TypeSite;
import sn.isra.seed.stock_service.repo.MembreOrgStockRepo;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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

    private final SiteRepo           siteRepo;
    private final MembreOrgStockRepo membreRepo;
    private final StockRepo          stockRepo;
    private final JdbcTemplate       jdbc;

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

    /* ── GET /api/sites/mes-sites — sites du membre connecté ── */
    @GetMapping("/mes-sites")
    public ResponseEntity<?> mesSites(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        var membreId = membreRepo.findMembreIdByUsername(username);
        if (membreId.isEmpty()) return ResponseEntity.ok(List.of());

        List<Site> personal = siteRepo.findByIdMembreOrderByEstPrincipalDescIdAsc(membreId.get());
        if (!personal.isEmpty()) return ResponseEntity.ok(personal);

        // Fallback : sites de l'organisation (UPSemCL, sélectionneur — sites institutionnels)
        var orgId = membreRepo.findOrgIdByUsername(username);
        if (orgId.isEmpty()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(siteRepo.findByIdOrganisationOrderByEstPrincipalDescIdAsc(orgId.get()));
    }

    /**
     * POST /api/sites/mes-sites
     * Crée un site pour le membre connecté. Code auto-généré : SITE-{USERNAME_PREFIX}-{N:02d}.
     * Body : { nomSite, typeSite, zoneCode, departement, localite, region, latitude, longitude }
     */
    @PostMapping("/mes-sites")
    public ResponseEntity<?> creerMonSite(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var membreIdOpt = membreRepo.findMembreIdByUsername(username);
        var orgIdOpt    = membreRepo.findOrgIdByUsername(username);
        if (membreIdOpt.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("message", "Membre introuvable"));

        Long membreId = membreIdOpt.get();
        Long orgId    = orgIdOpt.orElse(null);

        List<Site> existing = siteRepo.findByIdMembreOrderByEstPrincipalDescIdAsc(membreId);
        if (!existing.isEmpty())
            return ResponseEntity.status(409).body(Map.of("message",
                "Vous avez déjà un site enregistré. Modifiez-le plutôt que d'en créer un nouveau."));

        // Code unique basé sur le username : SITE-{PREFIX}-{N:02d}
        String prefix = username.toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (prefix.length() > 6) prefix = prefix.substring(0, 6);
        String codeSite;
        int n = existing.size() + 1;
        do {
            codeSite = String.format("SITE-%s-%02d", prefix, n++);
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
        s.setZoneCode(getString(body, "zoneCode"));
        s.setIdZoneAgro(parseLong(body.get("idZoneAgro")));
        s.setIdDepartement(parseInteger(body.get("idDepartement")));
        s.setIdMembre(membreId);
        s.setIdOrganisation(orgId);
        s.setEstPrincipal(existing.isEmpty());

        return ResponseEntity.ok(siteRepo.save(s));
    }

    /**
     * PUT /api/sites/mes-sites/{code}
     * Modifie un site appartenant au membre connecté.
     * Body : { nomSite, typeSite, zoneCode, departement, localite, region, latitude, longitude }
     */
    @PutMapping("/mes-sites/{code}")
    public ResponseEntity<?> modifierMonSite(
            @PathVariable String code,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var membreIdOpt = membreRepo.findMembreIdByUsername(username);
        if (membreIdOpt.isEmpty())
            return ResponseEntity.status(403).body(Map.of("message", "Accès non autorisé"));

        Long membreId = membreIdOpt.get();
        var siteOpt = siteRepo.findByCodeSiteAndIdMembre(code, membreId);
        if (siteOpt.isEmpty()) {
            var orgId = membreRepo.findOrgIdByUsername(username);
            if (orgId.isPresent()) siteOpt = siteRepo.findByCodeSiteAndIdOrganisation(code, orgId.get());
        }
        return siteOpt.map(s -> {
            String nom = getString(body, "nomSite");
            if (nom != null && !nom.isBlank()) s.setNomSite(nom.trim());
            if (body.containsKey("typeSite"))    s.setTypeSite(parseType(body.get("typeSite").toString()));
            if (body.containsKey("zoneCode"))      s.setZoneCode(getString(body, "zoneCode"));
            if (body.containsKey("idZoneAgro"))    s.setIdZoneAgro(parseLong(body.get("idZoneAgro")));
            if (body.containsKey("departement"))   s.setDepartement(getString(body, "departement"));
            if (body.containsKey("idDepartement")) s.setIdDepartement(parseInteger(body.get("idDepartement")));
            if (body.containsKey("localite"))      s.setLocalite(getString(body, "localite"));
            if (body.containsKey("region"))        s.setRegion(getString(body, "region"));
            if (body.containsKey("latitude"))      s.setLatitude(parseBD(body.get("latitude")));
            if (body.containsKey("longitude"))     s.setLongitude(parseBD(body.get("longitude")));
            return ResponseEntity.<Object>ok(siteRepo.save(s));
        }).orElse(ResponseEntity.status(403).build());
    }

    /**
     * DELETE /api/sites/mes-sites/{code}
     * Règles : pas de stock > 0 sur ce site, et pas le seul site du membre.
     */
    @DeleteMapping("/mes-sites/{code}")
    public ResponseEntity<?> supprimerMonSite(
            @PathVariable String code,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var membreIdOpt = membreRepo.findMembreIdByUsername(username);
        if (membreIdOpt.isEmpty())
            return ResponseEntity.status(403).body(Map.of("message", "Accès non autorisé"));

        Long membreId = membreIdOpt.get();
        return siteRepo.findByCodeSiteAndIdMembre(code, membreId).map(s -> {
            List<Site> mesSites = siteRepo.findByIdMembreOrderByEstPrincipalDescIdAsc(membreId);
            if (mesSites.size() <= 1)
                return ResponseEntity.badRequest().<Object>body(
                    Map.of("message", "Impossible de supprimer votre unique site"));

            // Vérifier stock restant
            Integer stockRestant = jdbc.queryForObject(
                "SELECT COALESCE(SUM(quantite_disponible), 0) FROM stock WHERE id_site = ?",
                Integer.class, s.getId());
            if (stockRestant != null && stockRestant > 0)
                return ResponseEntity.badRequest().<Object>body(
                    Map.of("message", "Ce site contient encore " + stockRestant + " kg en stock — videz le stock avant de supprimer"));

            if (Boolean.TRUE.equals(s.getEstPrincipal())) {
                mesSites.stream().filter(o -> !o.getId().equals(s.getId())).findFirst()
                    .ifPresent(next -> { next.setEstPrincipal(true); siteRepo.save(next); });
            }
            siteRepo.delete(s);
            return ResponseEntity.<Object>noContent().build();
        }).orElse(ResponseEntity.status(403).build());
    }

    /**
     * PATCH /api/sites/mes-sites/{code}/principal
     * Définit ce site comme principal pour le membre connecté.
     */
    @PatchMapping("/mes-sites/{code}/principal")
    public ResponseEntity<?> definirPrincipal(
            @PathVariable String code,
            @AuthenticationPrincipal Jwt jwt) {

        String username = jwt.getClaimAsString("preferred_username");
        var membreIdOpt = membreRepo.findMembreIdByUsername(username);
        if (membreIdOpt.isEmpty())
            return ResponseEntity.status(403).body(Map.of("message", "Accès non autorisé"));

        Long membreId = membreIdOpt.get();
        return siteRepo.findByCodeSiteAndIdMembre(code, membreId).map(s -> {
            siteRepo.findByIdMembreOrderByEstPrincipalDescIdAsc(membreId)
                .forEach(o -> { o.setEstPrincipal(o.getId().equals(s.getId())); siteRepo.save(o); });
            return ResponseEntity.<Object>ok(s);
        }).orElse(ResponseEntity.status(403).build());
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

    private Long parseLong(Object v) {
        if (v == null) return null;
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }

    private Integer parseInteger(Object v) {
        if (v == null) return null;
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return null; }
    }
}
