package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.repo.LotRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.Set;

/**
 * Gestion du certificat officiel (PDF ou image) attaché à chaque lot semencier.
 * Upload / Remplacement / Suppression : réservé aux rôles seed-admin, seed-selector,
 * seed-upsemcl et seed-multiplicator.
 * Lecture (visualisation + téléchargement) : tout utilisateur authentifié.
 */
@RestController
@RequestMapping("/api/lots")
@RequiredArgsConstructor
public class LotDocumentController {

    private final LotRepo lotRepo;

    @Value("${uploads.dir:/app/uploads}")
    private String uploadsDir;

    private static final Set<String> VALID_TYPES = Set.of(
        "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );

    // ── Upload / Remplacement ────────────────────────────────────────────────

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @PostMapping(value = "/{id}/certificat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LotSemencier> uploadCertificat(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide");
        if (!isValidDocument(file))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Formats acceptés : PDF, JPG, PNG, WEBP, GIF");

        LotSemencier lot = lotRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lot introuvable"));

        Path dir = Path.of(uploadsDir, "certificats");
        Files.createDirectories(dir);
        deleteExistingFiles(dir, String.valueOf(id));

        String ext      = extractExtension(file);
        String filename = id + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        lot.setCertificatPath("certificats/" + filename);
        return ResponseEntity.ok(lotRepo.save(lot));
    }

    // ── Lecture (visualisation inline ou téléchargement) ───────────────────

    @GetMapping("/{id}/certificat")
    public ResponseEntity<Resource> getCertificat(@PathVariable Long id) {
        LotSemencier lot = lotRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lot introuvable"));

        if (lot.getCertificatPath() == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun certificat disponible pour ce lot");

        Path path = Path.of(uploadsDir, lot.getCertificatPath());
        if (!Files.exists(path))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable sur le serveur");

        String ext = fileExt(path);
        return ResponseEntity.ok()
            .contentType(mediaTypeFor(ext))
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"certificat-" + lot.getCodeLot() + ext + "\"")
            .body(new FileSystemResource(path));
    }

    // ── Suppression ──────────────────────────────────────────────────────────

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @DeleteMapping("/{id}/certificat")
    public ResponseEntity<Void> deleteCertificat(@PathVariable Long id) throws IOException {
        LotSemencier lot = lotRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lot introuvable"));

        if (lot.getCertificatPath() != null) {
            Files.deleteIfExists(Path.of(uploadsDir, lot.getCertificatPath()));
            lot.setCertificatPath(null);
            lotRepo.save(lot);
        }
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private boolean isValidDocument(MultipartFile file) {
        String ct = file.getContentType();
        if (ct != null && VALID_TYPES.contains(ct.toLowerCase())) return true;
        String name = file.getOriginalFilename();
        if (name == null) return false;
        String lower = name.toLowerCase();
        return lower.endsWith(".pdf") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif");
    }

    private String extractExtension(MultipartFile file) {
        String ct = file.getContentType();
        if (ct != null) {
            if (ct.contains("pdf"))  return ".pdf";
            if (ct.contains("png"))  return ".png";
            if (ct.contains("webp")) return ".webp";
            if (ct.contains("gif"))  return ".gif";
            if (ct.contains("jpeg") || ct.contains("jpg")) return ".jpg";
        }
        String name = file.getOriginalFilename();
        if (name != null && name.contains("."))
            return name.substring(name.lastIndexOf('.'));
        return ".bin";
    }

    private void deleteExistingFiles(Path dir, String prefix) {
        try (var stream = Files.list(dir)) {
            stream.filter(p -> p.getFileName().toString().startsWith(prefix + "."))
                  .forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
        } catch (IOException ignored) {}
    }

    private String fileExt(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot) : "";
    }

    private MediaType mediaTypeFor(String ext) {
        return switch (ext.toLowerCase()) {
            case ".pdf"  -> MediaType.APPLICATION_PDF;
            case ".png"  -> MediaType.IMAGE_PNG;
            case ".gif"  -> MediaType.IMAGE_GIF;
            case ".jpg", ".jpeg" -> MediaType.IMAGE_JPEG;
            case ".webp" -> MediaType.parseMediaType("image/webp");
            default      -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }
}
