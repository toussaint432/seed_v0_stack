package sn.isra.seed.order_service.repo;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;

@Repository
public class LotReceptionRepo {

    private final NamedParameterJdbcTemplate jdbc;

    public LotReceptionRepo(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Génère un code de lot REC lisible à partir du lot parent :
     * format REC-{GEN}-{ESPECE}-{VARIETE}-{ANNEE}-{SEQ:02d}
     * ex: REC-G3-ARA-28206-2026-01
     */
    public String generateRecLotCode(Long parentLotId) {
        String sql = """
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
                    COALESCE(SUBSTRING(l.campagne FROM '[0-9]{4}$'),
                             EXTRACT(YEAR FROM NOW())::TEXT) AS annee
                FROM lot_semencier l
                JOIN generation_semence g ON g.id = l.id_generation
                WHERE l.id = :parentId
            ),
            prefix AS (
                SELECT 'REC-' || gen || '-' || espece || '-' || variete_part || '-' || annee AS pfx
                FROM meta
            ),
            seq AS (
                SELECT COALESCE(MAX(
                    CAST(SUBSTRING(code_lot FROM '[0-9]+$') AS INTEGER)
                ), 0) + 1 AS next_seq
                FROM lot_semencier
                WHERE code_lot ~ ('^' || (SELECT pfx FROM prefix) || '-[0-9]+$')
            )
            SELECT (SELECT pfx FROM prefix) || '-' || LPAD(next_seq::TEXT, 2, '0')
            FROM seq
            """;
        return jdbc.queryForObject(sql,
            new MapSqlParameterSource("parentId", parentLotId),
            String.class);
    }

    /**
     * Crée un lot_semencier pour le multiplicateur qui reçoit des semences via commande.
     * Copie id_variete, id_generation, campagne et code_espece du lot source UPSemCL.
     * Le lot parent reste le lot UPSemCL (traçabilité G3 → G4 → R1).
     * Retourne l'id du nouveau lot.
     */
    public Long createReceptionLot(Long parentId, String codeLot, Long idOrgAcheteur,
                                   String usernameAcheteur, BigDecimal quantite, String unite) {
        String sql = """
            INSERT INTO lot_semencier (
                code_lot, id_variete, id_generation, id_lot_parent,
                campagne, quantite_nette, unite,
                statut_lot, id_org_producteur, username_createur,
                created_at, date_production, code_espece,
                nom_variete, code_variete
            )
            SELECT
                :codeLot,
                l.id_variete, l.id_generation, :parentId,
                COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
                :quantite, :unite,
                'DISPONIBLE', :idOrg, :username,
                NOW(), CURRENT_DATE, l.code_espece,
                l.nom_variete, l.code_variete
            FROM lot_semencier l
            WHERE l.id = :parentId
            RETURNING id
            """;

        return jdbc.queryForObject(sql, new MapSqlParameterSource()
            .addValue("codeLot", codeLot)
            .addValue("parentId", parentId)
            .addValue("idOrg", idOrgAcheteur)
            .addValue("username", usernameAcheteur)
            .addValue("quantite", quantite)
            .addValue("unite", unite), Long.class);
    }
}
