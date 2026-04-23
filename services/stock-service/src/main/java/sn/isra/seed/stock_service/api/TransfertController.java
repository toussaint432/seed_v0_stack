package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.entity.Transfert;
import sn.isra.seed.stock_service.entity.enums.StatutTransfert;
import sn.isra.seed.stock_service.repo.TransfertRepo;
import sn.isra.seed.stock_service.service.StockTransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/transfers")
@RequiredArgsConstructor
public class TransfertController {

    private final TransfertRepo        transfertRepo;
    private final StockTransferService stockTransferService;

    @GetMapping
    public List<Transfert> list(
            @RequestParam(required = false) String roleSource,
            @RequestParam(required = false) Long idLot) {
        if (roleSource != null && !roleSource.isBlank())
            return transfertRepo.findByRoleSource(roleSource);
        if (idLot != null)
            return transfertRepo.findByIdLot(idLot);
        return transfertRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Transfert> getById(@PathVariable Long id) {
        return transfertRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Transfert create(@RequestBody Transfert transfert) {
        return transfertRepo.save(transfert);
    }

    /**
     * Mise à jour de statut avec logique métier complète sur ACCEPTE.
     *
     * Sur ACCEPTE (et seulement si les codes site sont renseignés) :
     *   1. SELECT ... FOR UPDATE → verrou pessimiste anti race-condition
     *   2. Validation du stock disponible → InsufficientStockException si KO
     *   3. UPDATE natif débit source (quantite_disponible - delta)
     *   4. INSERT/ON CONFLICT crédit destination (quantite_disponible + delta)
     *   5. Enregistrement MouvementStock (piste d'audit)
     *   6. Écriture outbox_events (même transaction)
     *   ↑ Toute cette séquence est ATOMIQUE — commit ou rollback total.
     */
    @Transactional
    @PatchMapping("/{id}/statut")
    public ResponseEntity<Transfert> updateStatut(
            @PathVariable Long id,
            @RequestParam String statut) {

        StatutTransfert nouveauStatut;
        try {
            nouveauStatut = StatutTransfert.valueOf(statut.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Statut invalide : " + statut
                + ". Valeurs acceptées : EN_ATTENTE, ACCEPTE, REJETE, ANNULE");
        }

        return transfertRepo.findById(id).map(t -> {

            boolean dejaAccepte = t.getStatut() == StatutTransfert.ACCEPTE;
            boolean avecSites   = t.getCodeSiteSource() != null
                               && t.getCodeSiteDestination() != null;

            if (nouveauStatut == StatutTransfert.ACCEPTE && !dejaAccepte && avecSites) {
                stockTransferService.appliquer(
                    t.getIdLot(),
                    t.getCodeSiteSource(),
                    t.getCodeSiteDestination(),
                    t.getQuantite(),
                    t.getUnite(),
                    t.getCodeTransfert()
                );
            } else if (nouveauStatut == StatutTransfert.ACCEPTE && !dejaAccepte && !avecSites) {
                log.warn("Transfert {} accepté sans codes site — stock non mis à jour.",
                         t.getCodeTransfert());
            }

            t.setStatut(nouveauStatut);
            return ResponseEntity.ok(transfertRepo.save(t));

        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!transfertRepo.existsById(id)) return ResponseEntity.notFound().build();
        transfertRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
