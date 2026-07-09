package sn.isra.seed.order_service.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sn.isra.seed.order_service.entity.Commande;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.kafka.OrderEventProducer;
import sn.isra.seed.order_service.repo.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests d'intégration de la couche web pour OrderController.
 *
 * Stratégie : @WebMvcTest charge uniquement le contexte web (controllers, filtres de sécurité,
 * @ControllerAdvice). Les repos et le producer Kafka sont remplacés par des mocks Mockito.
 * L'authentification JWT est simulée via SecurityMockMvcRequestPostProcessors.jwt().
 *
 * IMPORTANT : ObjectMapper n'est PAS mocké. Le mocker remplacerait le bean Jackson global
 * et casserait l'infrastructure Spring MVC (routerFunctionMapping l'utilise en interne).
 * @WebMvcTest configure automatiquement un vrai ObjectMapper via JacksonAutoConfiguration.
 */
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // Repos injectés dans OrderController
    @MockitoBean private CommandeRepo commandeRepo;
    @MockitoBean private LigneRepo ligneRepo;
    @MockitoBean private AllocationRepo allocationRepo;
    @MockitoBean private MembreOrganisationRepo membreRepo;
    @MockitoBean private StockOrderRepo stockOrderRepo;
    @MockitoBean private LotQuantiteRepo lotQuantiteRepo;
    @MockitoBean private TransfertLotOrderRepo transfertLotOrderRepo;
    @MockitoBean private OrderEventProducer producer;

    // Repos requis par les filtres de sécurité chargés dans la chaîne Spring MVC
    @MockitoBean private OrganisationRepo organisationRepo;

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Commande buildCommande(Long id) {
        Commande c = new Commande();
        c.setId(id);
        c.setCodeCommande("CMD-" + id);
        c.setClient("Client Test");
        c.setStatut(StatutCommande.SOUMISE);
        c.setUsernameAcheteur("testuser");
        c.setIdOrganisationAcheteur(1L);
        c.setCreatedAt(Instant.now());
        return c;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/orders/{id} avec ID existant → 200")
    void getById_commandeExistante_retourne200() throws Exception {
        Commande commande = buildCommande(42L);
        when(commandeRepo.findById(42L)).thenReturn(Optional.of(commande));

        mockMvc.perform(get("/api/orders/42")
                        .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.codeCommande").value("CMD-42"))
                .andExpect(jsonPath("$.client").value("Client Test"))
                .andExpect(jsonPath("$.statut").value("SOUMISE"));

        verify(commandeRepo).findById(42L);
    }

    @Test
    @DisplayName("GET /api/orders/{id} avec ID inexistant → 404")
    void getById_commandeAbsente_retourne404() throws Exception {
        when(commandeRepo.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/orders/999")
                        .with(jwt()))
                .andExpect(status().isNotFound());

        verify(commandeRepo).findById(999L);
    }

    @Test
    @DisplayName("GET /api/orders avec JWT → 200 et liste des commandes")
    void list_avecJwt_retourne200AvecListe() throws Exception {
        List<Commande> commandes = List.of(
                buildCommande(1L),
                buildCommande(2L)
        );
        // Le controller appelle findAll() quand le JWT ne contient pas le rôle seed-multiplicator
        when(commandeRepo.findAll()).thenReturn(commandes);

        mockMvc.perform(get("/api/orders")
                        .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].codeCommande").value("CMD-1"))
                .andExpect(jsonPath("$[1].codeCommande").value("CMD-2"));

        verify(commandeRepo).findAll();
    }

    @Test
    @DisplayName("POST /api/orders avec corps invalide (codeCommande et client absents) → 400")
    void create_corpsInvalide_retourne400() throws Exception {
        // @Valid est activé sur le controller : codeCommande et client sont @NotBlank.
        // Un body {} déclenche MethodArgumentNotValidException → GlobalExceptionHandler → 400.
        mockMvc.perform(post("/api/orders")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ECHOUEE"))
                .andExpect(jsonPath("$.erreurs").isArray());

        // Le repo ne doit jamais être appelé si la validation échoue
        verifyNoInteractions(commandeRepo);
    }

    @Test
    @DisplayName("GET /api/orders sans token → 401 (sécurité JWT activée)")
    void list_sansToken_retourne401() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(commandeRepo);
    }
}
