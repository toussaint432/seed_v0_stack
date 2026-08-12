package sn.isra.seed.common.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(
            MissingServletRequestParameterException ex, HttpServletRequest req) {
        return erreur(HttpStatus.BAD_REQUEST, "PARAMETRE_MANQUANT",
                "Paramètre obligatoire manquant : " + ex.getParameterName(), req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<String> erreurs = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " : " + f.getDefaultMessage())
                .collect(Collectors.toList());
        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("statut",     HttpStatus.BAD_REQUEST.value());
        corps.put("code",       "VALIDATION_ECHOUEE");
        corps.put("message",    "La requête contient des champs invalides.");
        corps.put("erreurs",    erreurs);
        corps.put("chemin",     req.getRequestURI());
        corps.put("horodatage", Instant.now().toString());
        return ResponseEntity.badRequest().body(corps);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest req) {
        List<String> erreurs = ex.getConstraintViolations().stream()
                .map(cv -> cv.getPropertyPath() + " : " + cv.getMessage())
                .collect(Collectors.toList());
        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("statut",     HttpStatus.BAD_REQUEST.value());
        corps.put("code",       "CONTRAINTE_VIOLEE");
        corps.put("message",    "Un ou plusieurs paramètres ne respectent pas les contraintes.");
        corps.put("erreurs",    erreurs);
        corps.put("chemin",     req.getRequestURI());
        corps.put("horodatage", Instant.now().toString());
        return ResponseEntity.badRequest().body(corps);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest req) {
        return erreur(HttpStatus.CONFLICT, "CONFLIT_DONNEES",
                "La ressource existe déjà ou viole une contrainte d'intégrité.", req);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(
            ResponseStatusException ex, HttpServletRequest req) {
        return erreur(HttpStatus.valueOf(ex.getStatusCode().value()),
                "ERREUR_METIER", ex.getReason() != null ? ex.getReason() : ex.getMessage(), req);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex, HttpServletRequest req) {
        return erreur(HttpStatus.FORBIDDEN, "ACCES_REFUSE",
                "Vous n'avez pas les droits nécessaires pour cette action.", req);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(
            IllegalArgumentException ex, HttpServletRequest req) {
        return erreur(HttpStatus.BAD_REQUEST, "PARAMETRE_INVALIDE", ex.getMessage(), req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(
            Exception ex, HttpServletRequest req) {
        log.error("Erreur inattendue sur {} {}: {}", req.getMethod(), req.getRequestURI(), ex.getMessage(), ex);
        return erreur(HttpStatus.INTERNAL_SERVER_ERROR, "ERREUR_INTERNE",
                "Une erreur interne est survenue. Veuillez réessayer.", req);
    }

    private ResponseEntity<Map<String, Object>> erreur(HttpStatus statut, String code,
            String message, HttpServletRequest req) {
        return ResponseEntity.status(statut).body(Map.of(
                "statut",      statut.value(),
                "code",        code,
                "message",     message != null ? message : "",
                "chemin",      req.getRequestURI(),
                "horodatage",  Instant.now().toString()
        ));
    }
}
