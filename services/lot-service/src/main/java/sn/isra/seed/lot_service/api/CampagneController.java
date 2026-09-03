package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.Campagne;
import sn.isra.seed.lot_service.entity.enums.StatutCampagne;
import sn.isra.seed.lot_service.repo.CampagneRepo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/campagnes")
@RequiredArgsConstructor
public class CampagneController {

    private final CampagneRepo campagneRepo;

    @GetMapping
    public List<Campagne> list(@RequestParam(required = false) String statut) {
        int currentYear = LocalDate.now().getYear();
        if (campagneRepo.findByAnnee(currentYear).isEmpty()) {
            autoCreateForYear(currentYear);
        }
        if (statut != null && !statut.isBlank())
            return campagneRepo.findByStatut(statut.toUpperCase());
        return campagneRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Campagne> getById(@PathVariable Long id) {
        return campagneRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PostMapping
    public Campagne create(@Valid @RequestBody Campagne campagne) {
        return campagneRepo.save(campagne);
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @PutMapping("/{id}")
    public ResponseEntity<Campagne> update(@PathVariable Long id, @Valid @RequestBody Campagne body) {
        return campagneRepo.findById(id).map(c -> {
            c.setCodeCampagne(body.getCodeCampagne());
            c.setLibelle(body.getLibelle());
            c.setAnnee(body.getAnnee());
            c.setDateDebut(body.getDateDebut());
            c.setDateFin(body.getDateFin());
            c.setStatut(body.getStatut());
            return ResponseEntity.ok(campagneRepo.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ROLE_seed-admin')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!campagneRepo.existsById(id)) return ResponseEntity.notFound().build();
        campagneRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void autoCreateForYear(int year) {
        int month = LocalDate.now().getMonthValue();

        // Calendrier agricole sénégalais
        // CSC : mars–juin | HIV : juillet–octobre | CSF : novembre–décembre (puis jan–fév de l'année suivante)
        StatutCampagne cscStatut  = (month >= 3 && month <= 6)  ? StatutCampagne.EN_COURS : StatutCampagne.PLANIFIEE;
        StatutCampagne hivStatut  = (month >= 7 && month <= 10) ? StatutCampagne.EN_COURS : StatutCampagne.PLANIFIEE;
        StatutCampagne csfStatut  = (month >= 11)               ? StatutCampagne.EN_COURS : StatutCampagne.PLANIFIEE;

        createIfAbsent("CSC-" + year, "Contre Saison Chaude " + year, year,
                LocalDate.of(year, 3, 1),  LocalDate.of(year, 6, 30),  cscStatut);
        createIfAbsent("HIV-" + year, "Hivernage " + year, year,
                LocalDate.of(year, 7, 1),  LocalDate.of(year, 10, 31), hivStatut);
        createIfAbsent("CSF-" + year, "Contre Saison Froide " + year, year,
                LocalDate.of(year, 11, 1), LocalDate.of(year + 1, 2, 28), csfStatut);
    }

    private void createIfAbsent(String code, String libelle, int annee,
                                 LocalDate debut, LocalDate fin, StatutCampagne statut) {
        if (!campagneRepo.existsByCodeCampagne(code)) {
            Campagne c = new Campagne();
            c.setCodeCampagne(code);
            c.setLibelle(libelle);
            c.setAnnee(annee);
            c.setDateDebut(debut);
            c.setDateFin(fin);
            c.setStatut(statut);
            campagneRepo.save(c);
        }
    }
}
