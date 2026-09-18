package sn.isra.seed.lot_service.repo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Accès direct à la table stock (partagée entre micro-services).
 * Utilisé par TransfertController pour créditer le stock du destinataire
 * de manière atomique et synchrone, sans dépendance Kafka.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class StockCreditRepo {

    private final JdbcTemplate jdbc;

    /** Informations de commande associée à un transfert généré par le order-service. */
    public record CommandeTransfertInfo(Long commandeId, Long ligneId, Long idOrgAcheteur, String usernameAcheteur) {}

    /**
     * Crédite le stock d'un lot dans un site identifié par son code.
     * UPSERT : crée l'entrée si elle n'existe pas, sinon incrémente quantite_disponible.
     */
    public boolean crediterSite(Long idLot, String codeSite, BigDecimal quantite) {
        try {
            int rows = jdbc.update("""
                INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
                VALUES (
                    ?,
                    (SELECT id FROM site WHERE code_site = ? LIMIT 1),
                    ?,
                    'kg'
                )
                ON CONFLICT (id_lot, id_site)
                DO UPDATE SET
                    quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible,
                    updated_at          = NOW()
                """, idLot, codeSite, quantite);
            return rows > 0;
        } catch (Exception e) {
            log.error("Échec crédit stock lot={} site={} qte={} : {}", idLot, codeSite, quantite, e.getMessage());
            return false;
        }
    }

    /**
     * Déduit la quantité du stock d'un lot dans un site identifié par son code.
     * Plancher à 0 pour éviter les valeurs négatives.
     */
    public boolean debiterSite(Long idLot, String codeSite, BigDecimal quantite) {
        try {
            int rows = jdbc.update("""
                UPDATE stock
                SET quantite_disponible = GREATEST(0, quantite_disponible - ?),
                    updated_at          = NOW()
                WHERE id_lot  = ?
                  AND id_site = (SELECT id FROM site WHERE code_site = ? LIMIT 1)
                """, quantite, idLot, codeSite);
            return rows > 0;
        } catch (Exception e) {
            log.error("Échec débit stock lot={} site={} qte={} : {}", idLot, codeSite, quantite, e.getMessage());
            return false;
        }
    }

    /**
     * Trouve le code du site qui détient actuellement un stock positif du lot,
     * appartenant à l'organisation de l'émetteur. Utilisé pour débiter la source
     * lors de l'acceptation d'un transfert.
     */
    public Optional<String> findSiteCodeForLot(Long idLot, String usernameEmetteur) {
        if (idLot == null || usernameEmetteur == null || usernameEmetteur.isBlank())
            return Optional.empty();
        List<String> rows = jdbc.query("""
            SELECT si.code_site
            FROM stock s
            JOIN site si ON si.id = s.id_site
            WHERE s.id_lot = ?
              AND si.id_organisation = (
                  SELECT mo.id_organisation
                  FROM membre_organisation mo
                  WHERE mo.keycloak_username = ?
                  LIMIT 1
              )
              AND s.quantite_disponible > 0
            ORDER BY s.created_at ASC
            LIMIT 1
            """,
            (rs, i) -> rs.getString("code_site"),
            idLot, usernameEmetteur
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Résout le code du site principal d'une organisation (le plus ancien par id).
     */
    public Optional<String> findPrimarySiteByOrgId(Long idOrg) {
        List<String> rows = jdbc.query(
            "SELECT code_site FROM site WHERE id_organisation = ? ORDER BY est_principal DESC, id ASC LIMIT 1",
            (rs, i) -> rs.getString("code_site"),
            idOrg
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Résout l'id_organisation du destinataire depuis membre_organisation.
     */
    public Optional<Long> findOrgIdByUsername(String username) {
        if (username == null || username.isBlank()) return Optional.empty();
        List<Long> rows = jdbc.query(
            "SELECT id_organisation FROM membre_organisation WHERE keycloak_username = ? LIMIT 1",
            (rs, i) -> rs.getLong("id_organisation"),
            username
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Marque la commande liée à un transfert comme LIVREE.
     * Met à jour uniquement si le statut n'est pas déjà terminal.
     */
    public void marquerCommandeLivree(String codeTransfert) {
        if (codeTransfert == null || codeTransfert.isBlank()) return;
        // Supporte les deux formats : code exact (mono-ligne) ET code prefixé -L{id} (multi-lignes)
        jdbc.update(
            "UPDATE commande SET statut = 'LIVREE'" +
            " WHERE (code_transfert_genere = ? OR ? LIKE (code_transfert_genere || '-%'))" +
            "   AND statut != 'LIVREE'",
            codeTransfert, codeTransfert
        );
    }

    /**
     * Vérifie si un transfert a été généré par le order-service (présence d'une commande liée).
     * Supporte les deux formats de code :
     *   - exact (mono-ligne) : WHERE code_transfert_genere = 'TL-XXX'
     *   - prefixé (multi-lignes) : WHERE 'TL-XXX-L40' LIKE (code_transfert_genere || '-%')
     */
    public Optional<CommandeTransfertInfo> findCommandeByTransfert(String codeTransfert) {
        if (codeTransfert == null || codeTransfert.isBlank()) return Optional.empty();
        List<CommandeTransfertInfo> rows = jdbc.query(
            """
            SELECT c.id AS commande_id, l.id AS ligne_id,
                   c.id_organisation_acheteur, c.username_acheteur
            FROM commande c
            JOIN ligne_commande l ON l.id_commande = c.id
            WHERE (c.code_transfert_genere = ? OR ? LIKE (c.code_transfert_genere || '-%'))
            LIMIT 1
            """,
            (rs, i) -> new CommandeTransfertInfo(
                rs.getLong("commande_id"),
                rs.getLong("ligne_id"),
                rs.getLong("id_organisation_acheteur"),
                rs.getString("username_acheteur")
            ),
            codeTransfert, codeTransfert
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Génère un code de lot REC lisible à partir du lot parent :
     * format REC-{GEN}-{ESPECE}-{VARIETE}-{code_campagne}-{NN}
     * ex: REC-G3-ARA-28206-HIV-2026-1
     */
    public String generateRecLotCode(Long parentLotId) {
        return jdbc.queryForObject("""
            WITH meta AS (
                SELECT
                    g.code_generation                        AS gen,
                    UPPER(COALESCE(l.code_espece, 'ESP'))    AS espece,
                    CASE
                        WHEN l.code_variete IS NOT NULL AND l.code_variete LIKE '%-%'
                            THEN UPPER(REPLACE(SUBSTRING(l.code_variete FROM POSITION('-' IN l.code_variete) + 1), '-', ''))
                        WHEN l.nom_variete IS NOT NULL AND TRIM(l.nom_variete) != ''
                            THEN UPPER(REGEXP_REPLACE(l.nom_variete, '[^A-Za-z0-9]', '', 'g'))
                        ELSE 'VAR'
                    END                                      AS variete_part,
                    COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT) AS code_campagne
                FROM lot_semencier l
                JOIN generation_semence g ON g.id = l.id_generation
                WHERE l.id = ?
            ),
            prefix AS (
                SELECT 'REC-' || gen || '-' || espece || '-' || variete_part || '-' || code_campagne AS pfx
                FROM meta
            ),
            seq AS (
                SELECT COALESCE(MAX(
                    CAST(SUBSTRING(code_lot FROM '[0-9]+$') AS INTEGER)
                ), 0) + 1 AS next_seq
                FROM lot_semencier
                WHERE code_lot ~ ('^' || (SELECT pfx FROM prefix) || '-[0-9]+$')
            )
            SELECT (SELECT pfx FROM prefix) || '-' || next_seq::TEXT
            FROM seq
            """,
            String.class,
            parentLotId
        );
    }

    /**
     * Crée un lot de réception (REC) pour le multiplicateur, enfant du lot UPSemCL source.
     * Copie métadonnées (variété, génération, campagne, espèce) depuis le lot parent.
     * Retourne l'id du nouveau lot.
     */
    public Long createReceptionLot(Long parentId, String codeLot,
                                    Long idOrgAcheteur, String usernameAcheteur,
                                    BigDecimal quantite, String unite) {
        return jdbc.queryForObject(
            """
            INSERT INTO lot_semencier (
                code_lot, id_variete, id_generation, id_lot_parent,
                campagne, quantite_nette, unite,
                statut_lot, id_org_producteur, username_createur,
                created_at, date_production, code_espece
            )
            SELECT ?, l.id_variete, l.id_generation, ?,
                COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
                ?, ?,
                'DISPONIBLE', ?, ?,
                NOW(), CURRENT_DATE, l.code_espece
            FROM lot_semencier l
            WHERE l.id = ?
            RETURNING id
            """,
            Long.class,
            codeLot, parentId, quantite, unite, idOrgAcheteur, usernameAcheteur, parentId
        );
    }
}
