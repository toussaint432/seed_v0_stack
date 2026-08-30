package sn.isra.seed.lot_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.common.util.JwtHelper;
import sn.isra.seed.lot_service.api.dto.CreateChildLotRequest;
import sn.isra.seed.lot_service.entity.Generation;
import sn.isra.seed.lot_service.entity.HistoriqueStatutLot;
import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.TransfertLot;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import sn.isra.seed.lot_service.kafka.LotEventProducer;
import sn.isra.seed.lot_service.repo.GenerationRepo;
import sn.isra.seed.lot_service.repo.HistoriqueStatutLotRepo;
import sn.isra.seed.lot_service.repo.LotRepo;
import sn.isra.seed.lot_service.repo.MembreOrgLotRepo;
import sn.isra.seed.lot_service.repo.StockCreditRepo;
import sn.isra.seed.lot_service.repo.TransfertLotRepo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LotService {

    private final LotRepo              lotRepo;
    private final GenerationRepo       generationRepo;
    private final TransfertLotRepo     transfertRepo;
    private final HistoriqueStatutLotRepo historiqueRepo;
    private final MembreOrgLotRepo     membreOrgRepo;
    private final StockCreditRepo      stockCreditRepo;
    private final LotEventProducer     producer;
    private final ObjectMapper         om;

    private static final Map<String, String> FLUX_RULES = Map.of(
        "seed-selector",  "seed-upsemcl",
        "seed-upsemcl",   "seed-multiplicator"
    );

    private static final Map<String, String> NEXT_GEN = Map.of(
        "G0", "G1", "G1", "G2", "G2", "G3",
        "G3", "G4", "G4", "R1", "R1", "R2"
    );

    // ── Liste ────────────────────────────────────────────────────────────────

    public Page<LotSemencier> list(String generation, Long idVariete, Jwt jwt, Pageable pageable) {
        List<String> roles = JwtHelper.extractRoles(jwt);

        if (roles.contains("seed-selector")) {
            String username = JwtHelper.getUsername(jwt);
            if (username == null) return Page.empty(pageable);
            String raw = jwt != null ? jwt.getClaimAsString("specialisation") : null;
            String specialisation = raw != null ? raw.toUpperCase() : null;
            return lotRepo.findForSelector(username, specialisation, pageable);
        }
        if (roles.contains("seed-upsemcl")) {
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return Page.empty(pageable);
            return lotRepo.findLotsUpsemcl(orgId, pageable);
        }
        if (roles.contains("seed-multiplicator")) {
            String username = JwtHelper.getUsername(jwt);
            if (username == null) return Page.empty(pageable);
            Long orgId = resolveOrgId(jwt);
            if (orgId == null) return Page.empty(pageable);
            return lotRepo.findMesLots(orgId, username, pageable);
        }
        if (roles.contains("seed-quotataire")) {
            return lotRepo.findR2Disponible(pageable);
        }
        if (generation != null && !generation.isBlank())
            return lotRepo.findByGeneration_CodeGeneration(generation, pageable);
        if (idVariete != null)
            return lotRepo.findByIdVariete(idVariete, pageable);
        return lotRepo.findAll(pageable);
    }

    // ── Création lot racine ──────────────────────────────────────────────────

    public LotSemencier create(LotSemencier lot, String siteCode, Jwt jwt) throws Exception {
        if (jwt != null) {
            String username = JwtHelper.getUsername(jwt);
            if (lot.getUsernameCreateur() == null) lot.setUsernameCreateur(username);
            if (lot.getResponsableNom() == null) {
                String fn = jwt.getClaimAsString("given_name");
                String ln = jwt.getClaimAsString("family_name");
                lot.setResponsableNom((fn != null ? fn : "") + " " + (ln != null ? ln : ""));
            }
            if (lot.getResponsableRole() == null)
                lot.setResponsableRole(JwtHelper.detectSeedRole(jwt));
            if (lot.getIdOrgProducteur() == null)
                lot.setIdOrgProducteur(resolveOrgId(jwt));
        }

        Generation resolvedGen = null;
        if (lot.getGeneration() != null && lot.getGeneration().getId() != null)
            resolvedGen = generationRepo.findById(lot.getGeneration().getId()).orElse(null);
        if (resolvedGen != null) lot.setGeneration(resolvedGen);

        if (lot.getUnite() == null || lot.getUnite().isBlank()) lot.setUnite("kg");
        if (lot.getStatutLot() == null) lot.setStatutLot(StatutLot.DISPONIBLE);

        LotSemencier saved;
        try {
            saved = lotRepo.save(lot);
            lotRepo.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Le code lot '" + lot.getCodeLot() + "' existe déjà — modifiez le code (ex : ajoutez -02, -03…).");
        }
        if (resolvedGen != null) saved.setGeneration(resolvedGen);

        producer.lotCreated(om.writeValueAsString(saved));

        List<String> roles = JwtHelper.extractRoles(jwt);
        String username = JwtHelper.getUsername(jwt);
        String effectiveSite = resolveFixedSite(roles, username);
        publishStockSync(saved, effectiveSite != null ? effectiveSite : siteCode);
        return saved;
    }

    // ── Création lot enfant ──────────────────────────────────────────────────

    @Transactional
    public LotSemencier createChild(Long parentId, CreateChildLotRequest req, Jwt jwt) throws Exception {
        LotSemencier parent = lotRepo.findById(parentId).orElseThrow();

        String parentGenCode = parent.getGeneration() != null
            ? parent.getGeneration().getCodeGeneration() : null;
        String expected = parentGenCode != null ? NEXT_GEN.get(parentGenCode) : null;
        if (expected == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "La génération " + parentGenCode + " est terminale — aucun lot enfant possible.");
        if (!expected.equals(req.generationCode()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Transition invalide : " + parentGenCode + " → " + req.generationCode()
                + ". Seule la transition " + parentGenCode + " → " + expected + " est autorisée.");

        if (jwt != null && JwtHelper.extractRoles(jwt).contains("seed-selector")) {
            String caller = JwtHelper.getUsername(jwt);
            if (caller == null || !caller.equals(parent.getUsernameCreateur()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Accès refusé : vous ne pouvez créer un lot enfant que depuis vos propres lots G0.");
        }

        if (req.quantiteSemenceSrcKg() != null
                && req.quantiteSemenceSrcKg().compareTo(BigDecimal.ZERO) > 0
                && parent.getQuantiteNette() != null
                && req.quantiteSemenceSrcKg().compareTo(parent.getQuantiteNette()) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Quantité demandée (" + req.quantiteSemenceSrcKg() + " kg) supérieure au disponible "
                + "(" + parent.getQuantiteNette() + " kg) sur le lot " + parent.getCodeLot() + ".");

        Generation gen = generationRepo.findByCodeGeneration(req.generationCode()).orElseThrow();

        LotSemencier child = new LotSemencier();
        child.setCodeLot(req.codeLot());
        child.setIdVariete(req.idVariete() != null ? req.idVariete() : parent.getIdVariete());
        // code_espece et campagne ↔ id_campagne sont gérés par les triggers DB (V44)
        child.setGeneration(gen);
        child.setLotParent(parent);
        child.setCampagne(req.campagne());
        child.setDateProduction(req.dateProduction());
        child.setQuantiteNette(req.quantiteNette());
        child.setUnite(req.unite() == null ? "kg" : req.unite());
        child.setTauxGermination(req.tauxGermination());
        child.setPuretePhysique(req.puretePhysique());
        child.setStatutLot(StatutLot.DISPONIBLE);
        child.setSuperficieHa(req.superficieHa());
        child.setProductionBruteKg(req.productionBruteKg());
        child.setCycle(req.cycle());
        child.setNiveauSemence(req.niveauSemence());
        child.setQuantiteSemenceSrcKg(req.quantiteSemenceSrcKg());

        if (req.superficieHa() != null && req.productionBruteKg() != null
                && req.superficieHa().compareTo(BigDecimal.ZERO) > 0) {
            child.setRendementKgHa(req.productionBruteKg()
                .divide(req.superficieHa(), 2, RoundingMode.HALF_UP));
        }

        if (jwt != null) {
            child.setUsernameCreateur(JwtHelper.getUsername(jwt));
            if (req.responsableNom() != null) {
                child.setResponsableNom(req.responsableNom());
            } else {
                String fn = jwt.getClaimAsString("given_name");
                String ln = jwt.getClaimAsString("family_name");
                child.setResponsableNom((fn != null ? fn : "") + " " + (ln != null ? ln : ""));
            }
            child.setResponsableRole(req.responsableRole() != null
                ? req.responsableRole() : JwtHelper.detectSeedRole(jwt));
            child.setIdOrgProducteur(
                req.idOrgProducteur() != null ? req.idOrgProducteur() : resolveOrgId(jwt));
        }

        LotSemencier saved;
        try {
            saved = lotRepo.save(child);
            lotRepo.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Le code lot '" + req.codeLot() + "' existe déjà — ajoutez un suffixe unique (ex : -02, -03…).");
        }

        List<String> childRoles = JwtHelper.extractRoles(jwt);
        String childUsername = JwtHelper.getUsername(jwt);
        String childFixedSite = resolveFixedSite(childRoles, childUsername);
        String effectiveSite = childFixedSite != null ? childFixedSite : req.siteCode();

        if (req.quantiteSemenceSrcKg() != null
                && req.quantiteSemenceSrcKg().compareTo(BigDecimal.ZERO) > 0) {
            lotRepo.debitQuantiteNette(parent.getId(), req.quantiteSemenceSrcKg());
            if (effectiveSite != null) {
                boolean ok = stockCreditRepo.debiterSite(parent.getId(), effectiveSite, req.quantiteSemenceSrcKg());
                if (ok) log.info("Stock débité parent : lot={} site={} qte={} kg", parent.getId(), effectiveSite, req.quantiteSemenceSrcKg());
                else    log.warn("Échec débit stock parent lot={} site={}", parent.getId(), effectiveSite);
            }
        }

        producer.lotCreated(om.writeValueAsString(saved));
        publishStockSync(saved, effectiveSite);
        return saved;
    }

    // ── Transfert ────────────────────────────────────────────────────────────

    @Transactional
    public TransfertLot transfer(Long id, String usernameDestinataire, String roleDestRaw,
                                 String observations, BigDecimal quantiteTransfert, Jwt jwt) {
        String usernameEmetteur = JwtHelper.getUsername(jwt);
        List<String> roles = JwtHelper.extractRoles(jwt);
        String roleEmetteur = roles.stream().filter(FLUX_RULES::containsKey).findFirst().orElse(null);

        if (roleEmetteur == null)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Rôle non autorisé à créer un transfert");

        LotSemencier lot = lotRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lot introuvable"));

        if (usernameDestinataire == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "usernameDestinataire requis");

        String roleDestinataire = roleDestRaw != null ? roleDestRaw : FLUX_RULES.get(roleEmetteur);
        String destAttendu = FLUX_RULES.get(roleEmetteur);
        if (!destAttendu.equals(roleDestinataire))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Flux non autorisé : " + roleEmetteur + " → " + roleDestinataire);

        String gen = lot.getGeneration() != null ? lot.getGeneration().getCodeGeneration() : "";
        boolean genOk = ("seed-selector".equals(roleEmetteur) && "G1".equals(gen))
                     || ("seed-upsemcl".equals(roleEmetteur) && List.of("G2", "G3").contains(gen));
        if (!genOk)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Génération " + gen + " non transférable pour " + roleEmetteur
                + ". Seuls les lots G1 peuvent être transférés par le sélectionneur.");

        if ("seed-selector".equals(roleEmetteur) && jwt != null) {
            String specialisation = jwt.getClaimAsString("specialisation");
            if (specialisation != null && lot.getCodeEspece() != null
                    && !specialisation.equalsIgnoreCase(lot.getCodeEspece()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Lot d'espèce " + lot.getCodeEspece()
                    + " hors de votre spécialisation (" + specialisation + ")");
        }

        if (quantiteTransfert == null || quantiteTransfert.compareTo(BigDecimal.ZERO) <= 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "La quantité à transférer doit être strictement positive");

        if (lot.getQuantiteNette() != null && quantiteTransfert.compareTo(lot.getQuantiteNette()) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Quantité insuffisante : disponible " + lot.getQuantiteNette().toPlainString()
                + " " + (lot.getUnite() != null ? lot.getUnite() : "kg")
                + ", demandé " + quantiteTransfert.toPlainString());

        TransfertLot t = new TransfertLot();
        t.setCodeTransfert("TL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        t.setIdLot(id);
        t.setUsernameEmetteur(usernameEmetteur);
        t.setRoleEmetteur(roleEmetteur);
        t.setUsernameDestinataire(usernameDestinataire);
        t.setRoleDestinataire(roleDestinataire);
        t.setGenerationTransferee(gen);
        t.setObservations(observations != null ? observations : "");
        t.setQuantite(quantiteTransfert);

        TransfertLot saved = transfertRepo.save(t);

        StatutLot ancienStatut = lot.getStatutLot();
        BigDecimal restant = lot.getQuantiteNette() != null
            ? lot.getQuantiteNette().subtract(quantiteTransfert) : BigDecimal.ZERO;
        lot.setQuantiteNette(restant.compareTo(BigDecimal.ZERO) >= 0 ? restant : BigDecimal.ZERO);
        StatutLot nouveauStatut = restant.compareTo(BigDecimal.ZERO) <= 0
            ? StatutLot.TRANSFERE : ancienStatut;
        lot.setStatutLot(nouveauStatut);
        lotRepo.save(lot);

        String siteEmetteur = resolveFixedSite(roles, usernameEmetteur);
        if (siteEmetteur != null) {
            boolean ok = stockCreditRepo.debiterSite(id, siteEmetteur, quantiteTransfert);
            if (ok) log.info("Stock débité émetteur : lot={} site={} qte={} kg (transfert {})", id, siteEmetteur, quantiteTransfert, saved.getCodeTransfert());
            else    log.warn("Échec débit stock émetteur lot={} site={} (transfert {})", id, siteEmetteur, saved.getCodeTransfert());
        }

        historiqueRepo.save(HistoriqueStatutLot.of(
            id, ancienStatut, nouveauStatut, usernameEmetteur,
            "Transfert " + gen + " — " + quantiteTransfert.toPlainString() + " kg"
            + " vers " + usernameDestinataire + " [" + roleDestinataire + "] — code: " + saved.getCodeTransfert()
            + (restant.compareTo(BigDecimal.ZERO) > 0
                ? " — restant: " + restant.toPlainString() + " kg" : " (lot complet)")
        ));

        return saved;
    }

    // ── Helpers internes ─────────────────────────────────────────────────────

    public Long resolveOrgId(Jwt jwt) {
        Long fromClaim = JwtHelper.resolveOrgIdFromClaim(jwt);
        if (fromClaim != null) return fromClaim;
        String username = JwtHelper.getUsername(jwt);
        return membreOrgRepo.findOrgIdByUsername(username).orElse(null);
    }

    private String resolveFixedSite(List<String> roles, String username) {
        if (roles.contains("seed-selector")) {
            return stockCreditRepo.findOrgIdByUsername(username)
                .flatMap(stockCreditRepo::findPrimarySiteByOrgId)
                .orElse("CNRA-BAMBEY");
        }
        if (roles.contains("seed-upsemcl")) {
            return stockCreditRepo.findOrgIdByUsername(username)
                .flatMap(stockCreditRepo::findPrimarySiteByOrgId)
                .orElse("UPSEMCL-SITE-BAMBEY");
        }
        return null;
    }

    private void publishStockSync(LotSemencier lot, String siteCode) {
        if (siteCode == null || siteCode.isBlank()) return;
        if (lot.getQuantiteNette() == null || lot.getQuantiteNette().compareTo(BigDecimal.ZERO) <= 0) return;
        boolean ok = stockCreditRepo.crediterSite(lot.getId(), siteCode, lot.getQuantiteNette());
        if (ok) log.info("Stock crédité : lot={} site={} qte={} kg", lot.getId(), siteCode, lot.getQuantiteNette());
        else     log.warn("Échec crédit stock lot={} site={}", lot.getId(), siteCode);
    }
}
