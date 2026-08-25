package sn.isra.seed.stock_service.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import sn.isra.seed.stock_service.api.dto.CatalogueItem;
import sn.isra.seed.stock_service.api.dto.CatalogueProximiteItem;
import sn.isra.seed.stock_service.repo.StockRepo;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests d'intégration de la couche web pour CatalogueController.
 *
 * Stratégie : @WebMvcTest charge uniquement le contexte web (controllers + filtres de sécurité)
 * sans démarrer un serveur complet ni se connecter à PostgreSQL.
 * StockRepo est remplacé par un @MockBean Mockito.
 * L'authentification JWT est simulée via SecurityMockMvcRequestPostProcessors.jwt().
 */
@WebMvcTest(CatalogueController.class)
class CatalogueControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StockRepo stockRepo;

    // ─────────────────────────────────────────────────────────────────────────
    // Implémentations internes des projections JPA (évite Mockito sur interfaces)
    // ─────────────────────────────────────────────────────────────────────────

    /** Implémentation de test pour CatalogueItem. */
    static class StubCatalogueItem implements CatalogueItem {
        private final String nomVariete;
        private final String codeEspece;

        StubCatalogueItem(String nomVariete, String codeEspece) {
            this.nomVariete = nomVariete;
            this.codeEspece = codeEspece;
        }

        @Override public Long   getVarieteId()          { return 1L; }
        @Override public String getNomVariete()          { return nomVariete; }
        @Override public String getCodeVariete()         { return "VAR-001"; }
        @Override public String getNomEspece()           { return "Mil"; }
        @Override public String getCodeEspece()          { return codeEspece; }
        @Override public Long   getLotId()               { return 10L; }
        @Override public String getCodeLot()             { return "LOT-001"; }
        @Override public String getGeneration()          { return "R1"; }
        @Override public String getCampagne()            { return "2024"; }
        @Override public Double getTauxGermination()     { return 95.0; }
        @Override public Double getQuantiteDisponible()  { return 500.0; }
        @Override public String getUnite()               { return "kg"; }
        @Override public Long   getSiteId()              { return 2L; }
        @Override public String getNomSite()             { return "Site Thiès"; }
        @Override public String getRegion()              { return "Thiès"; }
        @Override public Long   getOrganisationId()      { return 3L; }
        @Override public String getNomOrganisation()     { return "Org Test"; }
        @Override public Double getLatitude()            { return 14.7; }
        @Override public Double getLongitude()           { return -16.4; }
        @Override public String getNiveauAdaptation()    { return "OPTIMAL"; }
        @Override public String getNomComplet()           { return null; }
    }

    /** Implémentation de test pour CatalogueProximiteItem (étend CatalogueItem + distanceKm). */
    static class StubCatalogueProximiteItem extends StubCatalogueItem
            implements CatalogueProximiteItem {

        private final Double distanceKm;

        StubCatalogueProximiteItem(String nomVariete, String codeEspece, Double distanceKm) {
            super(nomVariete, codeEspece);
            this.distanceKm = distanceKm;
        }

        @Override public Double getDistanceKm() { return distanceKm; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /catalogue sans filtre → 200 avec 2 items")
    void getCatalogue_sansFiltre_retourne200AvecListe() throws Exception {
        List<CatalogueItem> items = List.of(
                new StubCatalogueItem("Souna III", "MIL"),
                new StubCatalogueItem("Gadiaba", "MIL")
        );
        when(stockRepo.findCatalogue(null, null)).thenReturn(items);

        mockMvc.perform(get("/api/stocks/catalogue")
                        .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].nomVariete").value("Souna III"))
                .andExpect(jsonPath("$[1].nomVariete").value("Gadiaba"));

        verify(stockRepo).findCatalogue(null, null);
    }

    @Test
    @DisplayName("GET /catalogue?espece=MIL → findCatalogue(\"MIL\", null) appelé")
    void getCatalogue_avecFiltreEspece_appelleRepoAvecCodeEspece() throws Exception {
        List<CatalogueItem> items = List.of(
                new StubCatalogueItem("Souna III", "MIL")
        );
        when(stockRepo.findCatalogue("MIL", null)).thenReturn(items);

        mockMvc.perform(get("/api/stocks/catalogue")
                        .param("espece", "MIL")
                        .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Vérifie que le controller a bien passé "MIL" (trimé et uppercased) au repo
        verify(stockRepo).findCatalogue("MIL", null);
    }

    @Test
    @DisplayName("GET /catalogue?espece=   (blanc) → findCatalogue(null, null) — blank converti en null")
    void getCatalogue_especeBlanche_convertiEnNull() throws Exception {
        when(stockRepo.findCatalogue(null, null)).thenReturn(List.of());

        mockMvc.perform(get("/api/stocks/catalogue")
                        .param("espece", "   ")
                        .with(jwt()))
                .andExpect(status().isOk());

        // Le controller doit normaliser blank → null
        verify(stockRepo).findCatalogue(null, null);
    }

    @Test
    @DisplayName("GET /catalogue/proximite avec lat/lng/rayonKm → 200")
    void getProximite_avecParams_retourne200() throws Exception {
        List<CatalogueProximiteItem> items = List.of(
                new StubCatalogueProximiteItem("Souna III", "MIL", 42.5)
        );
        when(stockRepo.findCatalogueProximite(14.7, -16.4, 200.0, null)).thenReturn(items);

        mockMvc.perform(get("/api/stocks/catalogue/proximite")
                        .param("lat", "14.7")
                        .param("lng", "-16.4")
                        .param("rayonKm", "200")
                        .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].distanceKm").value(42.5));
    }

    @Test
    @DisplayName("GET /catalogue/proximite sans lat/lng → 400 (paramètre obligatoire manquant)")
    void getProximite_sansLatLng_retourne400() throws Exception {
        mockMvc.perform(get("/api/stocks/catalogue/proximite")
                        .with(jwt()))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(stockRepo);
    }

    @Test
    @DisplayName("GET /catalogue sans token → 401 (sécurité JWT activée)")
    void getCatalogue_sansToken_retourne401() throws Exception {
        mockMvc.perform(get("/api/stocks/catalogue"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(stockRepo);
    }
}
