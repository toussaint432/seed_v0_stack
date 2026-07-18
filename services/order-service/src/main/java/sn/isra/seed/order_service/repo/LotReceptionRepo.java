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
                created_at, date_production, code_espece
            )
            SELECT
                :codeLot,
                l.id_variete, l.id_generation, :parentId,
                COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
                :quantite, :unite,
                'DISPONIBLE', :idOrg, :username,
                NOW(), CURRENT_DATE, l.code_espece
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
