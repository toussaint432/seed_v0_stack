package sn.isra.seed.order_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sn.isra.seed.order_service.api.dto.AdminInscriptionRequest;
import sn.isra.seed.order_service.entity.MembreOrganisation;
import sn.isra.seed.order_service.entity.Organisation;
import sn.isra.seed.order_service.entity.enums.TypeOrganisation;
import sn.isra.seed.order_service.repo.MembreOrganisationRepo;
import sn.isra.seed.order_service.repo.OrganisationRepo;

/**
 * Couche de persistance isolée du workflow SAGA.
 *
 * Cette classe est séparée de AdminInscriptionService pour une raison précise :
 * si les deux méthodes étaient dans la même classe, Spring ne pourrait pas appliquer
 * le proxy AOP sur un appel interne — @Transactional serait silencieusement ignoré.
 * En isolant @Transactional ici, la transaction SQL est atomique et rollbackable
 * indépendamment des appels Keycloak qui l'entourent dans AdminInscriptionService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminInscriptionPersistenceService {

    private final OrganisationRepo     organisationRepo;
    private final MembreOrganisationRepo membreRepo;
    private final JdbcTemplate         jdbc;

    /**
     * Cas A — Organisation inexistante.
     *
     * Crée dans cet ordre atomique :
     * 1. shared.organisation
     * 2. stock.site principal (JdbcTemplate, schéma explicite — hors portée JPA order-service)
     * 3. shared.membre_organisation (estPrincipal = true)
     *
     * @return ID de la ligne membre créée
     */
    @Transactional
    public PersistenceResult persisterCasA(AdminInscriptionRequest req, String keycloakUserId) {

        // 1. Créer l'organisation
        Organisation org = new Organisation();
        org.setNomOrganisation(req.nomOrganisation().trim());
        org.setTypeOrganisation(parseTypeOrg(req.typeOrganisation()));
        org.setRegion(req.regionOrg());
        org.setDepartement(req.departementOrg());
        org.setLocalite(req.localiteOrg());
        org.setContact(req.prenom().trim() + " " + req.nom().trim());
        org.setTelephone(req.telephone());
        org.setEmail(req.email());
        org.setActive(true);
        Organisation savedOrg = organisationRepo.save(org);
        log.info("[inscription-db] Organisation créée : id={} nom='{}'", savedOrg.getId(), savedOrg.getNomOrganisation());

        // 2. Créer le site principal dans stock.site (schéma explicite — cross-service via JdbcTemplate)
        String codeSite = genererCodeSite(req.username());
        String nomSite  = (req.nomSite() != null && !req.nomSite().isBlank())
                          ? req.nomSite().trim()
                          : "Site principal — " + savedOrg.getNomOrganisation();

        jdbc.update("""
            INSERT INTO stock.site
                (code_site, nom_site, type_site, departement, localite, region,
                 id_organisation, est_principal, zone_code, id_zone_agro, id_departement,
                 latitude, longitude)
            VALUES (?, ?, 'FERME', ?, ?, ?,
                    ?, true, ?, ?, ?,
                    ?, ?)
            """,
            codeSite, nomSite,
            req.departementSite(), req.localiteSite(), req.regionOrg(),
            savedOrg.getId(),
            req.zoneCode(), req.idZoneAgro(), req.idDepartement(),
            req.latitude(), req.longitude()
        );
        log.info("[inscription-db] Site principal créé : code={} org={}", codeSite, savedOrg.getId());

        // 3. Créer l'entrée membre_organisation (contact principal de l'org)
        MembreOrganisation membre = buildMembre(req, savedOrg, true);
        MembreOrganisation savedMembre = membreRepo.save(membre);
        log.info("[inscription-db] Membre créé (principal) : id={} username='{}'",
                 savedMembre.getId(), savedMembre.getKeycloakUsername());

        return new PersistenceResult(savedOrg.getId(), savedOrg.getNomOrganisation(),
                                     codeSite, savedMembre.getId(), true);
    }

    /**
     * Cas B — Organisation existante (ex: multi-agents UPSemCL).
     *
     * Crée uniquement :
     * 1. shared.membre_organisation (estPrincipal = false — l'org a déjà un contact principal)
     *
     * @return ID de la ligne membre créée
     */
    @Transactional
    public PersistenceResult persisterCasB(AdminInscriptionRequest req, String keycloakUserId) {

        Organisation org = organisationRepo.findById(req.idOrganisationExistante())
            .orElseThrow(() -> new IllegalArgumentException(
                "Organisation introuvable : id=" + req.idOrganisationExistante()));

        MembreOrganisation membre = buildMembre(req, org, false);
        MembreOrganisation savedMembre = membreRepo.save(membre);
        log.info("[inscription-db] Membre créé (non-principal) : id={} username='{}' org='{}'",
                 savedMembre.getId(), savedMembre.getKeycloakUsername(), org.getNomOrganisation());

        return new PersistenceResult(org.getId(), org.getNomOrganisation(),
                                     null, savedMembre.getId(), false);
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    private MembreOrganisation buildMembre(AdminInscriptionRequest req,
                                           Organisation org,
                                           boolean estPrincipal) {
        MembreOrganisation m = new MembreOrganisation();
        m.setKeycloakUsername(req.username());
        m.setKeycloakRole(req.role());
        m.setNomComplet((req.prenom().trim() + " " + req.nom().trim()).trim());
        m.setOrganisation(org);
        m.setRoleDansOrg(resolveRoleDansOrg(req.role()));
        m.setPrincipal(estPrincipal);
        m.setTelephone(req.telephone());
        m.setSpecialisation(req.specialisation());
        return m;
    }

    private String genererCodeSite(String username) {
        String prefix = username.toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (prefix.length() > 6) prefix = prefix.substring(0, 6);
        // Unicité garantie par le timestamp en suffixe si collision
        String base = "SITE-" + prefix + "-01";
        if (!siteExiste(base)) return base;
        return "SITE-" + prefix + "-" + (System.currentTimeMillis() % 10000);
    }

    private boolean siteExiste(String codeSite) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM stock.site WHERE code_site = ?", Integer.class, codeSite);
        return count != null && count > 0;
    }

    private TypeOrganisation parseTypeOrg(String val) {
        if (val == null) return TypeOrganisation.AUTRE;
        try { return TypeOrganisation.valueOf(val.toUpperCase()); }
        catch (Exception e) { return TypeOrganisation.AUTRE; }
    }

    private String resolveRoleDansOrg(String keycloakRole) {
        return switch (keycloakRole) {
            case "seed-multiplicator" -> "MULTIPLICATEUR";
            case "seed-quotataire"    -> "QUOTATAIRE";
            case "seed-upsemcl"       -> "AGENT_UPSEMCL";
            case "seed-selector"      -> "SELECTEUR";
            case "seed-admin"         -> "ADMINISTRATEUR";
            default                   -> "MEMBRE";
        };
    }

    /** DTO interne de retour entre les couches de persistance et d'orchestration. */
    public record PersistenceResult(
        Long   idOrganisation,
        String nomOrganisation,
        String codeSite,        // null en Cas B
        Long   idMembre,
        boolean estPrincipal
    ) {}
}
