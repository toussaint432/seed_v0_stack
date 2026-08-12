package sn.isra.seed.catalog_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;

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
class CatalogIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mockMvc;
    @Autowired EspeceRepo especeRepo;
    @Autowired VarieteRepo varieteRepo;
    @Autowired ObjectMapper objectMapper;

    private Long especeId;
    private Long varieteId;

    @BeforeEach
    void setUp() {
        Espece e = new Espece();
        e.setCodeEspece("TST-SOJA");
        e.setNomCommun("Soja Test");
        e.setNomScientifique("Glycine max test");
        e = especeRepo.save(e);
        especeId = e.getId();

        Variete v = new Variete();
        v.setCodeVariete("TST-VAR-001");
        v.setNomVariete("Variété Intégration");
        v.setEspece(e);
        v.setStatutVariete(StatutVariete.DIFFUSEE);
        v = varieteRepo.save(v);
        varieteId = v.getId();
    }

    // ── Helpers JWT ────────────────────────────────────────────────────────────

    static RequestPostProcessor admin() {
        return jwt()
            .authorities(new SimpleGrantedAuthority("ROLE_seed-admin"))
            .jwt(j -> j.claim("preferred_username", "test-admin")
                       .claim("realm_access", Map.of("roles", java.util.List.of("seed-admin"))));
    }

    static RequestPostProcessor selector() {
        return jwt()
            .authorities(new SimpleGrantedAuthority("ROLE_seed-selector"))
            .jwt(j -> j.claim("preferred_username", "test-selector")
                       .claim("specialisation", "TST")
                       .claim("realm_access", Map.of("roles", java.util.List.of("seed-selector"))));
    }

    // ── Espèces ────────────────────────────────────────────────────────────────

    @Test
    void species_list_returnsNonEmptyList() throws Exception {
        mockMvc.perform(get("/api/species").with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    void species_getById_returnsEspece() throws Exception {
        mockMvc.perform(get("/api/species/{id}", especeId).with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.codeEspece", is("TST-SOJA")))
            .andExpect(jsonPath("$.nomCommun", is("Soja Test")));
    }

    @Test
    void species_getById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/species/9999999").with(admin()))
            .andExpect(status().isNotFound());
    }

    @Test
    void species_create_adminRole_returns201() throws Exception {
        Espece newEspece = new Espece();
        newEspece.setCodeEspece("TST-COTTON");
        newEspece.setNomCommun("Coton Test");

        mockMvc.perform(post("/api/species").with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(newEspece)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.codeEspece", is("TST-COTTON")));
    }

    @Test
    void species_create_missingCode_returns400() throws Exception {
        Espece invalid = new Espece();
        invalid.setNomCommun("Espèce sans code");

        mockMvc.perform(post("/api/species").with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void species_create_nonAdmin_returns403() throws Exception {
        Espece e = new Espece();
        e.setCodeEspece("TST-REFUSED");
        e.setNomCommun("Refusé");

        mockMvc.perform(post("/api/species").with(selector())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(e)))
            .andExpect(status().isForbidden());
    }

    // ── Variétés ───────────────────────────────────────────────────────────────

    @Test
    void varieties_list_returnsPaginatedPage() throws Exception {
        mockMvc.perform(get("/api/varieties").with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.page.totalElements", greaterThanOrEqualTo(1)));
    }

    @Test
    void varieties_filteredByEspeceId_returnsOnlyThatEspece() throws Exception {
        mockMvc.perform(get("/api/varieties").with(admin())
                .param("especeId", especeId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].especeId", is(especeId.intValue())));
    }

    @Test
    void varieties_filteredByStatut_DIFFUSEE_returnsOk() throws Exception {
        mockMvc.perform(get("/api/varieties").with(admin())
                .param("statut", "DIFFUSEE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    void varieties_invalidStatut_returns400() throws Exception {
        mockMvc.perform(get("/api/varieties").with(admin())
                .param("statut", "STATUT_INEXISTANT"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void varieties_getById_returnsVariete() throws Exception {
        mockMvc.perform(get("/api/varieties/{id}", varieteId).with(admin()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.codeVariete", is("TST-VAR-001")))
            .andExpect(jsonPath("$.nomVariete", is("Variété Intégration")));
    }

    @Test
    void varieties_getById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/varieties/9999999").with(admin()))
            .andExpect(status().isNotFound());
    }

    @Test
    void varieties_create_adminRole_returns201() throws Exception {
        Variete newV = new Variete();
        newV.setCodeVariete("TST-VAR-NEW");
        newV.setNomVariete("Nouvelle Variété");
        Espece ref = new Espece();
        ref.setId(especeId);
        newV.setEspece(ref);
        newV.setStatutVariete(StatutVariete.DIFFUSEE);

        mockMvc.perform(post("/api/varieties").with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(newV)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.codeVariete", is("TST-VAR-NEW")));
    }

    @Test
    void varieties_updateStatut_changesStatut() throws Exception {
        mockMvc.perform(patch("/api/varieties/{id}/statut", varieteId).with(admin())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"statut": "EN_TEST"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.statutVariete", is("EN_TEST")));
    }
}
