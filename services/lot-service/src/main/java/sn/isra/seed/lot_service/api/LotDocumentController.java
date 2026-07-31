package sn.isra.seed.lot_service.api;

import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.enums.StatutCertification;
import sn.isra.seed.lot_service.repo.LotRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Gestion du certificat officiel et du workflow de certification des lots.
 *
 * Workflow (G4 / R1 / R2) :
 *   SANS_CERTIFICAT ──[upload multiplicateur]──▶ EN_ATTENTE
 *   EN_ATTENTE      ──[approuver upsemcl/admin]─▶ CERTIFIE  (vert)
 *   EN_ATTENTE      ──[rejeter  upsemcl/admin]──▶ REJETE    (rouge)
 *   REJETE          ──[ré-upload multiplicateur]─▶ EN_ATTENTE
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

    // ══════════════════════════════════════════════════════════════════
    // Lecture certificat (tout rôle authentifié)
    // ══════════════════════════════════════════════════════════════════

    @GetMapping("/{id}/certificat")
    public ResponseEntity<Resource> getCertificat(@PathVariable Long id) {
        LotSemencier lot = findLot(id);
        if (lot.getCertificatPath() == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun certificat pour ce lot");

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

    // ══════════════════════════════════════════════════════════════════
    // Upload certificat — multiplicateur (ou admin/upsemcl)
    // Met le lot en EN_ATTENTE de validation
    // ══════════════════════════════════════════════════════════════════

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl','ROLE_seed-multiplicator')")
    @PostMapping(value = "/{id}/certificat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LotSemencier> uploadCertificat(
            @PathVariable Long id,
            @RequestParam MultipartFile file) throws IOException {

        if (file.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide");
        if (!isValidDocument(file))
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Formats acceptés : PDF, JPG, PNG, WEBP, GIF");

        LotSemencier lot = findLot(id);

        Path dir = Path.of(uploadsDir, "certificats");
        Files.createDirectories(dir);
        deleteExistingFiles(dir, String.valueOf(id));

        String ext      = extractExtension(file);
        String filename = id + ext;
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        lot.setCertificatPath("certificats/" + filename);
        lot.setStatutCertification(StatutCertification.EN_ATTENTE);
        // Réinitialiser l'approbation précédente si re-soumission après rejet
        lot.setApprobateurUsername(null);
        lot.setDateApprobation(null);
        lot.setMotifRejetCert(null);

        return ResponseEntity.ok(lotRepo.save(lot));
    }

    // ══════════════════════════════════════════════════════════════════
    // Suppression certificat — réservé admin/upsemcl
    // Repasse en SANS_CERTIFICAT
    // ══════════════════════════════════════════════════════════════════

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
    @DeleteMapping("/{id}/certificat")
    public ResponseEntity<Void> deleteCertificat(@PathVariable Long id) throws IOException {
        LotSemencier lot = findLot(id);
        if (lot.getCertificatPath() != null) {
            Files.deleteIfExists(Path.of(uploadsDir, lot.getCertificatPath()));
            lot.setCertificatPath(null);
            lot.setStatutCertification(StatutCertification.SANS_CERTIFICAT);
            lot.setApprobateurUsername(null);
            lot.setDateApprobation(null);
            lot.setMotifRejetCert(null);
            lotRepo.save(lot);
        }
        return ResponseEntity.noContent().build();
    }

    // ══════════════════════════════════════════════════════════════════
    // Liste des lots en attente de certification (UPSemCL / Admin)
    // ══════════════════════════════════════════════════════════════════

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
    @GetMapping("/a-certifier")
    public List<LotSemencier> lotsACertifier() {
        return lotRepo.findLotsACertifier();
    }

    /** Tous les lots G4/R1/R2 (tous statuts) — vue complète certification UPSemCL/Admin */
    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
    @GetMapping("/certifiables")
    public List<LotSemencier> lotsCertifiables() {
        return lotRepo.findAllCertifiables();
    }

    /** Lots G4/R1/R2 DU multiplicateur connecté uniquement — isolation individuelle */
    @PreAuthorize("hasAuthority('ROLE_seed-multiplicator')")
    @GetMapping("/mes-lots-certif")
    public List<LotSemencier> mesLotsCertif(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return List.of();
        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) return List.of();
        return lotRepo.findMesLotsCertif(username);
    }

    // ══════════════════════════════════════════════════════════════════
    // Approuver la certification — UPSemCL / Admin → CERTIFIE (vert)
    // ══════════════════════════════════════════════════════════════════

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
    @PatchMapping("/{id}/certifier")
    public ResponseEntity<LotSemencier> approuverCertification(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        LotSemencier lot = findLot(id);
        if (lot.getStatutCertification() != StatutCertification.EN_ATTENTE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Seuls les lots EN_ATTENTE peuvent être approuvés (statut actuel : "
                    + lot.getStatutCertification() + ")");

        String approbateur = jwt != null ? jwt.getClaimAsString("preferred_username") : "system";
        lot.setStatutCertification(StatutCertification.CERTIFIE);
        lot.setApprobateurUsername(approbateur);
        lot.setDateApprobation(Instant.now());
        lot.setMotifRejetCert(null);

        return ResponseEntity.ok(lotRepo.save(lot));
    }

    // ══════════════════════════════════════════════════════════════════
    // Rejeter la certification — UPSemCL / Admin → REJETE (rouge)
    // Body attendu : { "motif": "..." }
    // ══════════════════════════════════════════════════════════════════

    @PreAuthorize("hasAnyAuthority('ROLE_seed-admin','ROLE_seed-upsemcl')")
    @PatchMapping("/{id}/rejeter-certification")
    public ResponseEntity<LotSemencier> rejeterCertification(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        String motif = body.getOrDefault("motif", "").trim();
        if (motif.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Le motif de rejet est obligatoire");

        LotSemencier lot = findLot(id);
        if (lot.getStatutCertification() != StatutCertification.EN_ATTENTE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Seuls les lots EN_ATTENTE peuvent être rejetés (statut actuel : "
                    + lot.getStatutCertification() + ")");

        String approbateur = jwt != null ? jwt.getClaimAsString("preferred_username") : "system";
        lot.setStatutCertification(StatutCertification.REJETE);
        lot.setApprobateurUsername(approbateur);
        lot.setDateApprobation(Instant.now());
        lot.setMotifRejetCert(motif);

        return ResponseEntity.ok(lotRepo.save(lot));
    }

    // ══════════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════════

    private LotSemencier findLot(Long id) {
        return lotRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lot introuvable"));
    }

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
