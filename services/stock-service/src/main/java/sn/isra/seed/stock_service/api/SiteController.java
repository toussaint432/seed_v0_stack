package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.entity.Site;
import sn.isra.seed.stock_service.repo.SiteRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sites")
@RequiredArgsConstructor
public class SiteController {

    private final SiteRepo siteRepo;

    @GetMapping
    public List<Site> list(
            @RequestParam(required = false) String region,
            @RequestParam(required = false) Long idOrganisation) {
        // Phase 3 : filtres additionnels à ajouter ici
        return siteRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Site> getById(@PathVariable Long id) {
        return siteRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Site create(@RequestBody Site site) {
        return siteRepo.save(site);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Site> update(@PathVariable Long id, @RequestBody Site body) {
        return siteRepo.findById(id).map(s -> {
            if (body.getCodeSite() != null) s.setCodeSite(body.getCodeSite());
            if (body.getNomSite() != null) s.setNomSite(body.getNomSite());
            if (body.getTypeSite() != null) s.setTypeSite(body.getTypeSite());
            if (body.getLocalite() != null) s.setLocalite(body.getLocalite());
            if (body.getRegion() != null) s.setRegion(body.getRegion());
            // Phase 1 : GPS + organisation
            if (body.getLatitude() != null) s.setLatitude(body.getLatitude());
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
}
