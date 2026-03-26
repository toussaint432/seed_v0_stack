package sn.isra.seed.lot_service.api;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import sn.isra.seed.lot_service.entity.Certification;
import sn.isra.seed.lot_service.repo.CertificationRepo;
import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/certifications")
@RequiredArgsConstructor
public class CertificationController {

    private final CertificationRepo repo;

    @GetMapping
    public List<Certification> list(@RequestParam(required = false) Long idLot) {
        if (idLot != null) return repo.findByIdLot(idLot);
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Certification> getById(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Certification create(@RequestBody Certification cert) {
        return repo.save(cert);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Certification> update(@PathVariable Long id,
                                                 @RequestBody Certification body) {
        return repo.findById(id).map(existing -> {
            body.setId(id);
            body.setCreatedAt(existing.getCreatedAt());
            // Conserver le document existant si non fourni dans la requête
            if (body.getContenuDocument() == null) {
                body.setContenuDocument(existing.getContenuDocument());
                body.setNomDocument(existing.getNomDocument());
            }
            return ResponseEntity.ok(repo.save(body));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Upload du fichier certificat ──────────────────────────────────
    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Certification> upload(@PathVariable Long id,
                                                 @RequestParam MultipartFile file) throws IOException {
        return repo.findById(id).map(cert -> {
            try {
                cert.setNomDocument(file.getOriginalFilename());
                cert.setContenuDocument(file.getBytes());
                return ResponseEntity.ok(repo.save(cert));
            } catch (IOException e) {
                throw new RuntimeException("Échec de l'upload : " + e.getMessage());
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Téléchargement du fichier certificat ──────────────────────────
    @GetMapping("/{id}/document")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        return repo.findById(id).map(cert -> {
            if (cert.getContenuDocument() == null) return ResponseEntity.notFound().<byte[]>build();
            String filename = cert.getNomDocument() != null ? cert.getNomDocument() : "certificat.pdf";
            String contentType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(cert.getContenuDocument());
        }).orElse(ResponseEntity.notFound().build());
    }
}
