package sn.isra.seed.catalog_service.api;

import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.util.Set;

/**
 * Gestion des documents (PDF ou image) attachés aux entités du catalogue :
 *  - Fiche variétale  : 1 document par variété  (PDF ou image)
 *  - Itinéraire technique : 1 document par espèce (PDF ou image)
 *
 * Stockage : système de fichiers local, répertoire configurable via UPLOADS_DIR.
 * Lecture   : accessible sans authentification.
 * Upload / Suppression : réservé aux rôles seed-admin et seed-selector.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DocumentController {

    private final VarieteRepo varieteRepo;
    private final EspeceRepo  especeRepo;

    @Value("${uploads.dir:/app/uploads}")
    private String uploadsDir;

    private static final Set<String> VALID_TYPES = Set.of(
        "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );

    // ── Fiche variétale ──────────────────────────────────────────────────────

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @PostMapping(value = "/varieties/{id}/fiche-varietale", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Variete> uploadFicheVarietale(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) throws IOException {

        if (file.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide");
        if (!isValidDocument(file))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Formats acceptés : PDF, JPG, PNG, WEBP, GIF");

        Variete variete = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

        checkSelectorSpec(jwt, variete.getEspece().getCodeEspece());

        Path dir = Path.of(uploadsDir, "fiches");
        Files.createDirectories(dir);
        deleteExistingFiles(dir, String.valueOf(id));

        String ext      = extractExtension(file);
        String filename = id + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        variete.setFicheVarietalePath("fiches/" + filename);
        return ResponseEntity.ok(varieteRepo.save(variete));
    }

    @GetMapping("/varieties/{id}/fiche-varietale")
    public ResponseEntity<Resource> getFicheVarietale(@PathVariable Long id) {
        Variete variete = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

        if (variete.getFicheVarietalePath() == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucune fiche variétale disponible");

        Path path = Path.of(uploadsDir, variete.getFicheVarietalePath());
        if (!Files.exists(path))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable sur le serveur");

        String ext = fileExt(path);
        return ResponseEntity.ok()
            .contentType(mediaTypeFor(ext))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"fiche-" + variete.getCodeVariete() + ext + "\"")
            .body(new FileSystemResource(path));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @DeleteMapping("/varieties/{id}/fiche-varietale")
    public ResponseEntity<Void> deleteFicheVarietale(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) throws IOException {
        Variete variete = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));
        checkSelectorSpec(jwt, variete.getEspece().getCodeEspece());
        if (variete.getFicheVarietalePath() != null) {
            Files.deleteIfExists(Path.of(uploadsDir, variete.getFicheVarietalePath()));
            variete.setFicheVarietalePath(null);
            varieteRepo.save(variete);
        }
        return ResponseEntity.noContent().build();
    }

    // ── Itinéraire technique ─────────────────────────────────────────────────

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @PostMapping(value = "/especes/{id}/itineraire-technique", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Espece> uploadItineraireTechnique(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) throws IOException {

        if (file.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide");
        if (!isValidDocument(file))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Formats acceptés : PDF, JPG, PNG, WEBP, GIF");

        Espece espece = especeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espèce introuvable"));

        checkSelectorSpec(jwt, espece.getCodeEspece());

        Path dir = Path.of(uploadsDir, "itineraires");
        Files.createDirectories(dir);
        deleteExistingFiles(dir, String.valueOf(id));

        String ext      = extractExtension(file);
        String filename = id + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        espece.setItineraireTechPath("itineraires/" + filename);
        return ResponseEntity.ok(especeRepo.save(espece));
    }

    @GetMapping("/especes/{id}/itineraire-technique")
    public ResponseEntity<Resource> getItineraireTechnique(@PathVariable Long id) {
        Espece espece = especeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espèce introuvable"));

        if (espece.getItineraireTechPath() == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun itinéraire technique disponible");

        Path path = Path.of(uploadsDir, espece.getItineraireTechPath());
        if (!Files.exists(path))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable sur le serveur");

        String ext = fileExt(path);
        return ResponseEntity.ok()
            .contentType(mediaTypeFor(ext))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"itineraire-" + espece.getCodeEspece() + ext + "\"")
            .body(new FileSystemResource(path));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-selector')")
    @DeleteMapping("/especes/{id}/itineraire-technique")
    public ResponseEntity<Void> deleteItineraireTechnique(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) throws IOException {
        Espece espece = especeRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espèce introuvable"));
        checkSelectorSpec(jwt, espece.getCodeEspece());
        if (espece.getItineraireTechPath() != null) {
            Files.deleteIfExists(Path.of(uploadsDir, espece.getItineraireTechPath()));
            espece.setItineraireTechPath(null);
            especeRepo.save(espece);
        }
        return ResponseEntity.noContent().build();
    }

    // ── Utilitaires ──────────────────────────────────────────────────────────

    private boolean isValidDocument(MultipartFile file) {
        String ct   = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (VALID_TYPES.contains(ct)) return true;
        return name.matches(".*\\.(pdf|jpg|jpeg|png|webp|gif)$");
    }

    private String extractExtension(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name != null && name.contains(".")) {
            return name.substring(name.lastIndexOf('.')).toLowerCase();
        }
        String ct = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        if (ct.contains("pdf"))  return ".pdf";
        if (ct.contains("jpeg") || ct.contains("jpg")) return ".jpg";
        if (ct.contains("png"))  return ".png";
        if (ct.contains("webp")) return ".webp";
        if (ct.contains("gif"))  return ".gif";
        return ".pdf";
    }

    private String fileExt(Path path) {
        String fn = path.getFileName().toString();
        int dot = fn.lastIndexOf('.');
        return dot >= 0 ? fn.substring(dot).toLowerCase() : "";
    }

    private MediaType mediaTypeFor(String ext) {
        return switch (ext) {
            case ".jpg", ".jpeg" -> MediaType.IMAGE_JPEG;
            case ".png"          -> MediaType.IMAGE_PNG;
            case ".gif"          -> MediaType.IMAGE_GIF;
            case ".webp"         -> MediaType.valueOf("image/webp");
            default              -> MediaType.APPLICATION_PDF;
        };
    }

    /**
     * Pour les sélectionneurs, vérifie que leur claim JWT {@code specialisation}
     * correspond au code espèce de la ressource manipulée.
     * Les admins passent toujours. Lève 403 sinon.
     */
    private void checkSelectorSpec(Jwt jwt, String codeEspece) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
            .getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_seed-admin"));
        if (isAdmin) return;

        String specialisation = jwt != null ? jwt.getClaimAsString("specialisation") : null;
        if (specialisation == null || !specialisation.equalsIgnoreCase(codeEspece)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Accès refusé : votre spécialisation (" + specialisation + ") "
                + "ne correspond pas à l'espèce " + codeEspece);
        }
    }

    private void deleteExistingFiles(Path dir, String idPrefix) throws IOException {
        if (!Files.exists(dir)) return;
        try (var stream = Files.list(dir)) {
            stream.filter(p -> {
                String fn = p.getFileName().toString();
                return fn.startsWith(idPrefix + ".") && fn.length() > idPrefix.length() + 1;
            }).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) {}
            });
        }
    }
}
