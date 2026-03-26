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
    public List<Site> list() {
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
            s.setCodeSite(body.getCodeSite());
            s.setNomSite(body.getNomSite());
            s.setTypeSite(body.getTypeSite());
            s.setLocalite(body.getLocalite());
            s.setRegion(body.getRegion());
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
