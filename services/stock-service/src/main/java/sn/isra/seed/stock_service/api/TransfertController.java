package sn.isra.seed.stock_service.api;

import sn.isra.seed.stock_service.entity.Transfert;
import sn.isra.seed.stock_service.entity.enums.StatutTransfert;
import sn.isra.seed.stock_service.repo.TransfertRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/transfers")
@RequiredArgsConstructor
public class TransfertController {

    private final TransfertRepo transfertRepo;

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

    @PatchMapping("/{id}/statut")
    public ResponseEntity<Transfert> updateStatut(
            @PathVariable Long id,
            @RequestParam String statut) {
        StatutTransfert nouveauStatut;
        try {
            nouveauStatut = StatutTransfert.valueOf(statut.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Statut invalide : " + statut + ". Valeurs acceptées : EN_ATTENTE, ACCEPTE, REJETE, ANNULE");
        }
        return transfertRepo.findById(id).map(t -> {
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
