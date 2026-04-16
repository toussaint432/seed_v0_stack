package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/generations")
@RequiredArgsConstructor
public class GenerationController {

    private final GenerationRepo generationRepo;

    @GetMapping
    public List<Generation> list() {
        return generationRepo.findAll()
            .stream()
            .sorted(Comparator.comparingInt(Generation::getOrdreGeneration))
            .toList();
    }
}
