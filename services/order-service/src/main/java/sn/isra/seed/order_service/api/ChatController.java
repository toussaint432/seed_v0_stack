package sn.isra.seed.order_service.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import sn.isra.seed.order_service.api.dto.*;
import sn.isra.seed.order_service.entity.*;
import sn.isra.seed.order_service.repo.*;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    /* ── Canaux autorisés (bidirectionnels) ── */
    private static final Map<String, Set<String>> CANAUX = Map.of(
        "seed-quotataire",    Set.of("seed-multiplicator"),
        "seed-multiplicator", Set.of("seed-quotataire", "seed-upsemcl"),
        "seed-upsemcl",        Set.of("seed-multiplicator", "seed-selector"),
        "seed-selector",      Set.of("seed-upsemcl"),
        "seed-admin",         Set.of("seed-quotataire","seed-multiplicator","seed-upsemcl","seed-selector","seed-admin")
    );

    private static final Path UPLOAD_DIR = Paths.get("/app/uploads/chat");

    private final ConversationRepo convRepo;
    private final MessageRepo      msgRepo;
    private final MembreOrganisationRepo membreRepo;
    private final CommandeRepo     commandeRepo;
    private final ObjectMapper     om;

    /* ════════════════════════════════════════
       GET /api/chat/conversations
       ════════════════════════════════════════ */
    @GetMapping("/conversations")
    public List<ConversationSummary> listConversations(@AuthenticationPrincipal Jwt jwt) {
        String me = username(jwt);
        List<Conversation> convs = convRepo.findByParticipant(me);

        return convs.stream().map(c -> {
            String autre = c.getParticipant1().equals(me) ? c.getParticipant2() : c.getParticipant1();
            var membreOpt = membreRepo.findByKeycloakUsername(autre);
            String nom  = membreOpt.map(MembreOrganisation::getNomComplet).orElse(autre);
            String role = membreOpt.map(MembreOrganisation::getKeycloakRole).orElse("—");
            String org  = membreOpt.map(m -> m.getOrganisation().getNomOrganisation()).orElse("—");

            List<Message> recents = msgRepo.findRecentByConversation(c.getId(), PageRequest.of(0, 1));
            String dernMsg  = recents.isEmpty() ? "" : apercu(recents.get(0));
            String dernType = recents.isEmpty() ? "TEXT" : recents.get(0).getType();
            long nonLus = msgRepo.countByIdConversationAndLuFalseAndExpediteurNot(c.getId(), me);

            return new ConversationSummary(c.getId(), autre, nom, role, org,
                dernMsg, dernType, c.getDernierMessageAt(), nonLus);
        }).toList();
    }

    /* ════════════════════════════════════════
       POST /api/chat/conversations
       ════════════════════════════════════════ */
    @PostMapping("/conversations")
    public ResponseEntity<Conversation> createOrFind(
            @RequestBody CreateConversationRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String me   = username(jwt);
        String dest = req.destinataireUsername();

        // Validation canal
        String monRole   = roleOf(me);
        String roleDestinataire = roleOf(dest);
        if (!canalAutorise(monRole, roleDestinataire)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // Idempotent : retrouver ou créer
        Optional<Conversation> existing = convRepo.findByParticipants(me, dest);
        if (existing.isPresent()) return ResponseEntity.ok(existing.get());

        Conversation c = new Conversation();
        // participant_1 = le plus petit alphabétiquement → garantit l'unicité
        if (me.compareTo(dest) <= 0) { c.setParticipant1(me); c.setParticipant2(dest); }
        else                         { c.setParticipant1(dest); c.setParticipant2(me); }
        return ResponseEntity.status(HttpStatus.CREATED).body(convRepo.save(c));
    }

    /* ════════════════════════════════════════
       GET /api/chat/conversations/{id}/messages
       ════════════════════════════════════════ */
    @GetMapping("/conversations/{id}/messages")
    @Transactional
    public ResponseEntity<List<Message>> getMessages(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal Jwt jwt) {

        String me = username(jwt);
        Conversation conv = convRepo.findById(id).orElse(null);
        if (conv == null || !estParticipant(conv, me))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        // Marquer comme lus les messages reçus
        msgRepo.markAsRead(id, me);

        List<Message> msgs = msgRepo.findRecentByConversation(id, PageRequest.of(page, size));
        // Inverser pour avoir les plus anciens en premier
        List<Message> result = new ArrayList<>(msgs);
        Collections.reverse(result);
        return ResponseEntity.ok(result);
    }

    /* ════════════════════════════════════════
       POST /api/chat/conversations/{id}/messages
       ════════════════════════════════════════ */
    @PostMapping("/conversations/{id}/messages")
    @Transactional
    public ResponseEntity<Message> sendMessage(
            @PathVariable Long id,
            @RequestBody CreateMessageRequest req,
            @AuthenticationPrincipal Jwt jwt) throws Exception {

        String me = username(jwt);
        Conversation conv = convRepo.findById(id).orElse(null);
        if (conv == null || !estParticipant(conv, me))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        // Validation contenu
        String type = req.type() != null ? req.type() : "TEXT";
        if ("TEXT".equals(type) || "COMMANDE".equals(type)) {
            if (req.contenu() == null || req.contenu().isBlank())
                return ResponseEntity.badRequest().build();
            if (req.contenu().length() > 2000)
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
        }

        Message msg = new Message();
        msg.setIdConversation(id);
        msg.setExpediteur(me);
        msg.setType(type);
        msg.setContenu(req.contenu() != null ? req.contenu().strip() : null);

        // Si c'est une COMMANDE, créer aussi l'entrée dans commande
        if ("COMMANDE".equals(msg.getType()) && msg.getContenu() != null) {
            creerCommandeDepuisMessage(me, conv, msg.getContenu());
        }

        Message saved = msgRepo.save(msg);
        conv.setDernierMessageAt(LocalDateTime.now());
        convRepo.save(conv);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /* ════════════════════════════════════════
       POST /api/chat/conversations/{id}/messages/upload
       ════════════════════════════════════════ */
    @PostMapping("/conversations/{id}/messages/upload")
    @Transactional
    public ResponseEntity<Message> uploadMedia(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) throws IOException {

        String me = username(jwt);
        Conversation conv = convRepo.findById(id).orElse(null);
        if (conv == null || !estParticipant(conv, me))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        String contentType = file.getContentType() != null ? file.getContentType() : "";
        String msgType;
        long maxSize;

        if (contentType.startsWith("audio/")) {
            if (!List.of("audio/webm","audio/mp4","audio/mpeg","audio/ogg").stream()
                    .anyMatch(contentType::startsWith))
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build();
            msgType = "AUDIO";
            maxSize = 2L * 1024 * 1024; // 2 Mo
        } else if (contentType.startsWith("image/")) {
            if (!List.of("image/jpeg","image/png","image/webp").stream()
                    .anyMatch(contentType::startsWith))
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build();
            msgType = "IMAGE";
            maxSize = 5L * 1024 * 1024; // 5 Mo
        } else {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build();
        }

        if (file.getSize() > maxSize)
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();

        // Sauvegarder le fichier
        Files.createDirectories(UPLOAD_DIR);
        String ext      = extension(file.getOriginalFilename());
        String filename = System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0,8) + ext;
        Files.copy(file.getInputStream(), UPLOAD_DIR.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        Message msg = new Message();
        msg.setIdConversation(id);
        msg.setExpediteur(me);
        msg.setType(msgType);
        msg.setUrlMedia("/api/chat/files/" + filename);
        msg.setNomFichier(file.getOriginalFilename());
        msg.setTailleFichier((int) file.getSize());

        Message saved = msgRepo.save(msg);
        conv.setDernierMessageAt(LocalDateTime.now());
        convRepo.save(conv);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /* ════════════════════════════════════════
       GET /api/chat/files/{filename}
       ════════════════════════════════════════ */
    @GetMapping("/files/{filename}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) throws IOException {
        // Sécurité : pas de traversal
        if (filename.contains("..") || filename.contains("/"))
            return ResponseEntity.badRequest().build();

        Path file = UPLOAD_DIR.resolve(filename);
        Resource resource = new UrlResource(file.toUri());
        if (!resource.exists()) return ResponseEntity.notFound().build();

        String contentType = Files.probeContentType(file);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
            .contentType(contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM)
            .body(resource);
    }

    /* ════════════════════════════════════════
       GET /api/chat/unread-count
       ════════════════════════════════════════ */
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal Jwt jwt) {
        String me = username(jwt);
        Long total = msgRepo.countTotalUnread(me);
        return Map.of("count", total != null ? total : 0L);
    }

    /* ════════════════════════════════════════
       Helpers privés
       ════════════════════════════════════════ */

    private String username(Jwt jwt) {
        return jwt.getClaimAsString("preferred_username");
    }

    private String roleOf(String username) {
        return membreRepo.findByKeycloakUsername(username)
            .map(MembreOrganisation::getKeycloakRole)
            .orElse("");
    }

    private boolean canalAutorise(String roleEmetteur, String roleDest) {
        if ("seed-admin".equals(roleEmetteur)) return true;
        Set<String> allowed = CANAUX.getOrDefault(roleEmetteur, Set.of());
        return allowed.contains(roleDest) || "seed-admin".equals(roleDest);
    }

    private boolean estParticipant(Conversation conv, String username) {
        return conv.getParticipant1().equals(username) || conv.getParticipant2().equals(username);
    }

    private String apercu(Message m) {
        return switch (m.getType()) {
            case "AUDIO"    -> "🎤 Message vocal";
            case "IMAGE"    -> "📷 Image";
            case "COMMANDE" -> "🛒 Commande";
            default         -> m.getContenu() != null
                ? (m.getContenu().length() > 60 ? m.getContenu().substring(0, 60) + "…" : m.getContenu())
                : "";
        };
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.'));
    }

    private void creerCommandeDepuisMessage(String username, Conversation conv, String json)
            throws Exception {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = om.readValue(json, Map.class);
            String autre = conv.getParticipant1().equals(username)
                ? conv.getParticipant2() : conv.getParticipant1();
            Long orgFourn = membreRepo.findByKeycloakUsername(autre)
                .map(m -> m.getOrganisation().getId()).orElse(null);
            Long orgAchet = membreRepo.findByKeycloakUsername(username)
                .map(m -> m.getOrganisation().getId()).orElse(null);

            Commande c = new Commande();
            c.setCodeCommande("CHAT-" + System.currentTimeMillis());
            c.setClient(username);
            c.setStatut("SOUMISE");
            c.setUsernameAcheteur(username);
            c.setIdOrganisationAcheteur(orgAchet);
            c.setIdOrganisationFournisseur(orgFourn);
            String notes = data.get("notes") != null ? data.get("notes").toString() : null;
            c.setObservations(notes);
            c.setCreatedAt(Instant.now());
            commandeRepo.save(c);
        } catch (Exception e) {
            // Si le JSON est mal formé, le message est quand même enregistré
        }
    }
}
