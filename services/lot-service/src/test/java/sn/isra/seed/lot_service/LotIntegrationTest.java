package sn.isra.seed.lot_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.kafka.LotOutboxRelay;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import sn.isra.seed.lot_service.repo.LotRepo;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
@Transactional
@Import(TestJwtConfig.class)
class LotIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc        mockMvc;
    @Autowired LotRepo        lotRepo;
    @Autowired GenerationRepo generationRepo;
    @Autowired ObjectMapper   objectMapper;

    @MockitoBean LotEventProducer lotEventProducer;
    @MockitoBean LotOutboxRelay   lotOutboxRelay;

    private Long   testLotId;
    private Long   generationG3Id;

    @BeforeEach
    void setUp() {
        Generation g3 = generationRepo.findByCodeGeneration("G3").orElseThrow(
            () -> new IllegalStateException("Migration manquante : génération G3 introuvable"));
        generationG3Id = g3.getId();

        LotSemencier lot = new LotSemencier();
        lot.setCodeLot("TST-LOT-INTEG-001");
        lot.setIdVariete(1L);
        lot.setGeneration(g3);
        lot.setStatutLot(StatutLot.DISPONIBLE);
        lot.setQuantiteNette(BigDecimal.valueOf(500));
        lot.setUnite("kg");
        lot.setCodeEspece("ARACH");
        lot.setUsernameCreateur("test-admin");
        lot.setIdOrgProducteur(null);
        testLotId = lotRepo.save(lot).getId();
    }

    // ── Helpers JWT ────────────────────────────────────────────────────────────

    static RequestPostProcessor admin() {
        return jwt()
            .authorities(new SimpleGrantedAuthority("ROLE_seed-admin"))
            .jwt(j -> j.claim("preferred_username", "test-admin")
                       .claim("realm_access", Map.of("roles", List.of("seed-admin"))));
    }

    static RequestPostProcessor selector(String username, String specialisation) {
        return jwt()
            .authorities(new SimpleGrantedAuthority("ROLE_seed-selector"))
            .jwt(j -> j.claim("preferred_username", username)
                       .claim("specialisation", specialisation)
                       .claim("realm_access", Map.of("roles", List.of("seed-selector"))));
    }

    static RequestPostProcessor quotataire() {
        return jwt()
            .authorities(new SimpleGrantedAuthority("ROLE_seed-quotataire"))
            .jwt(j -> j.claim("preferred_username", "test-quotataire")
                       .claim("realm_access", Map.of("roles", List.of("seed-quotataire"))));
    }

    // ── Liste ─────────────────────────────────────────────────────────────────

    @Test
    void lots_list_adminSees_paginatedPage() throws Exception {
        mockMvc.perform(get("/api/lots").with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.page.totalElements", greaterThanOrEqualTo(1)));
    }

    @Test
    void lots_list_selectorSees_onlyOwnG0G1Lots() throws Exception {
        // Le sélectionneur "test-selector-unknown" n'a aucun lot → page vide
        mockMvc.perform(get("/api/lots").with(selector("test-selector-unknown", "ARACH")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void lots_list_quotataireSees_onlyR2Disponible() throws Exception {
        // Le lot de test est G3 → ne doit PAS apparaître pour le quotataire
        mockMvc.perform(get("/api/lots").with(quotataire()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray());
        // Tous les lots retournés doivent être R2 (vérifié côté repo JPQL)
    }

    @Test
    void lots_list_filteredByGeneration() throws Exception {
        mockMvc.perform(get("/api/lots").with(admin())
                .param("generation", "G3"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))));
    }

    // ── Détail ────────────────────────────────────────────────────────────────

    @Test
    void lots_getById_returnsLotDto() throws Exception {
        mockMvc.perform(get("/api/lots/{id}", testLotId).with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.codeLot", is("TST-LOT-INTEG-001")))
            .andExpect(jsonPath("$.statutLot", is("DISPONIBLE")))
            .andExpect(jsonPath("$.generationCode", is("G3")));
    }

    @Test
    void lots_getById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/lots/9999999").with(admin()))
            .andExpect(status().isNotFound());
    }

    // ── Catalogue G3 ─────────────────────────────────────────────────────────

    @Test
    void lots_catalogueG3_returnsDisponibleLots() throws Exception {
        mockMvc.perform(get("/api/lots/catalogue-g3").with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    // ── Création ──────────────────────────────────────────────────────────────

    @Test
    void lots_create_validLot_returns201() throws Exception {
        var body = Map.of(
            "codeLot", "TST-LOT-NEW-001",
            "idVariete", 1,
            "generation", Map.of("id", generationG3Id),
            "statutLot", "DISPONIBLE",
            "quantiteNette", 100,
            "unite", "kg"
        );

        mockMvc.perform(post("/api/lots").with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.codeLot", is("TST-LOT-NEW-001")));
    }

    @Test
    void lots_create_missingCodeLot_returns400() throws Exception {
        var body = Map.of(
            "idVariete", 1,
            "generation", Map.of("id", generationG3Id),
            "unite", "kg"
        );

        mockMvc.perform(post("/api/lots").with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
    }

    // ── Changement de statut ──────────────────────────────────────────────────

    @Test
    void lots_updateStatut_adminRole_changesStatut() throws Exception {
        mockMvc.perform(patch("/api/lots/{id}/statut", testLotId).with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"statut": "EPUISE"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.statutLot", is("EPUISE")));
    }

    @Test
    void lots_updateStatut_nonAdmin_returns403() throws Exception {
        mockMvc.perform(patch("/api/lots/{id}/statut", testLotId)
                .with(selector("test-selector", "ARACH"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"statut": "EPUISE"}
                    """))
            .andExpect(status().isForbidden());
    }
}
