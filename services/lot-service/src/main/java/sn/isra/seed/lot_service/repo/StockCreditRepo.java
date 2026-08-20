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
        jdbc.update(
            "UPDATE commande SET statut = 'LIVREE' WHERE code_transfert_genere = ? AND statut != 'LIVREE'",
            codeTransfert
        );
    }

    /**
     * Vérifie si un transfert a été généré par le order-service (présence d'une commande liée).
     * Retourne les informations nécessaires pour créer le lot REC côté lot-service.
     */
    public Optional<CommandeTransfertInfo> findCommandeByTransfert(String codeTransfert) {
        if (codeTransfert == null || codeTransfert.isBlank()) return Optional.empty();
        List<CommandeTransfertInfo> rows = jdbc.query(
            """
            SELECT c.id AS commande_id, l.id AS ligne_id,
                   c.id_organisation_acheteur, c.username_acheteur
            FROM commande c
            JOIN ligne_commande l ON l.id_commande = c.id
            WHERE c.code_transfert_genere = ?
            LIMIT 1
            """,
            (rs, i) -> new CommandeTransfertInfo(
                rs.getLong("commande_id"),
                rs.getLong("ligne_id"),
                rs.getLong("id_organisation_acheteur"),
                rs.getString("username_acheteur")
            ),
            codeTransfert
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
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
