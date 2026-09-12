package sn.isra.seed.order_service.api;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Intercepteur global des exceptions pour order-service.
 *
 * Transforme les exceptions techniques (PostgreSQL, Hibernate, validation)
 * en réponses HTTP lisibles par l'interface utilisateur.
 * Aucun stack trace ne fuite vers le client.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String SENTINEL_BLOCAGE = "LOTS_ACTIFS_BLOCAGE:";

    /**
     * Intercepte les violations d'intégrité des données.
     *
     * Cas principal : le trigger PostgreSQL trg_protection_lots_orphelins a avorté
     * la transaction car l'organisation possède encore des lots actifs.
     * Le message RAISE EXCEPTION est extrait via getMostSpecificCause().
     *
     * Autres cas : contrainte unique, FK violée → 409 Conflict générique.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException e) {
        String causeMessage = e.getMostSpecificCause().getMessage();
        log.warn("[GlobalExceptionHandler] DataIntegrityViolation : {}", causeMessage);

        if (causeMessage != null && causeMessage.contains(SENTINEL_BLOCAGE)) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", extraireMessageTrigger(causeMessage)));
        }

        // Contrainte unique (username, code_lot, etc.)
        if (causeMessage != null && causeMessage.contains("unique constraint")) {
            return ResponseEntity.status(409)
                .body(Map.of("message", "Cette valeur existe déjà — doublon détecté."));
        }

        return ResponseEntity.status(409)
            .body(Map.of("message", "Opération refusée : contrainte de données violée."));
    }

    /**
     * Certaines versions de Spring/Hibernate remontent RAISE EXCEPTION en JpaSystemException.
     * Ce handler couvre ce cas alternatif.
     */
    @ExceptionHandler(JpaSystemException.class)
    public ResponseEntity<Map<String, String>> handleJpaSystem(JpaSystemException e) {
        String causeMessage = rootMessage(e);
        log.warn("[GlobalExceptionHandler] JpaSystemException : {}", causeMessage);

        if (causeMessage != null && causeMessage.contains(SENTINEL_BLOCAGE)) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", extraireMessageTrigger(causeMessage)));
        }

        return ResponseEntity.status(500)
            .body(Map.of("message", "Erreur système inattendue. Contactez l'administrateur."));
    }

    /**
     * Erreurs de validation @Valid sur les DTOs (ex: champ obligatoire manquant).
     * Retourne 400 avec la liste des champs invalides.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        var erreurs = e.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                fe -> fe.getField(),
                fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Valeur invalide",
                (a, b) -> a
            ));
        log.warn("[GlobalExceptionHandler] Validation échouée : {}", erreurs);
        return ResponseEntity.badRequest()
            .body(Map.of("message", "Données invalides", "champs", erreurs));
    }

    /**
     * ResponseStatusException lancées explicitement dans les controllers.
     * Relayées telles quelles pour ne pas masquer les 404/403/409 intentionnels.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
            .body(Map.of("message", e.getReason() != null ? e.getReason() : e.getMessage()));
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    /**
     * Extrait la partie lisible du message PostgreSQL RAISE EXCEPTION.
     *
     * Message brut PostgreSQL :
     *   "ERROR: LOTS_ACTIFS_BLOCAGE: Désactivation impossible — l'organisation ... \n  Where: ..."
     *
     * Retourne :
     *   "Désactivation impossible — l'organisation "X" possède encore N lot(s) actif(s)..."
     */
    private String extraireMessageTrigger(String pgMessage) {
        int idx = pgMessage.indexOf(SENTINEL_BLOCAGE);
        if (idx < 0) return pgMessage;

        String apres = pgMessage.substring(idx + SENTINEL_BLOCAGE.length()).strip();
        // Couper au premier saut de ligne (le reste est le stack PL/pgSQL)
        int newline = apres.indexOf('\n');
        return newline > 0 ? apres.substring(0, newline).strip() : apres;
    }

    private String rootMessage(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null) cause = cause.getCause();
        return cause.getMessage();
    }
}
