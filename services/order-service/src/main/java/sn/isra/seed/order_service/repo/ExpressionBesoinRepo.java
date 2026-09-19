package sn.isra.seed.order_service.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sn.isra.seed.order_service.entity.ExpressionBesoin;
import sn.isra.seed.order_service.entity.enums.StatutExpressionBesoin;

import java.util.List;

public interface ExpressionBesoinRepo extends JpaRepository<ExpressionBesoin, Long> {

    List<ExpressionBesoin> findByUsernameCreateurOrderByCreatedAtDesc(String username);

    List<ExpressionBesoin> findByStatutNotOrderByCreatedAtDesc(StatutExpressionBesoin statut);

    @Query("""
        SELECT e FROM ExpressionBesoin e
        WHERE e.statut != sn.isra.seed.order_service.entity.enums.StatutExpressionBesoin.ANNULEE
        ORDER BY e.campagneCible ASC, e.nomVariete ASC, e.createdAt DESC
        """)
    List<ExpressionBesoin> findAllActives();

    @Query(value = """
        SELECT id_variete, nom_variete, code_espece, nom_espece, campagne_cible,
               SUM(quantite_souhaitee) AS total_kg,
               COUNT(*) AS nb_demandeurs
        FROM orders.expression_besoin
        WHERE statut != 'ANNULEE'
        GROUP BY id_variete, nom_variete, code_espece, nom_espece, campagne_cible
        ORDER BY campagne_cible ASC, nom_variete ASC
        """, nativeQuery = true)
    List<Object[]> findAgregeesRaw();

    long countByUsernameCreateurAndStatut(String username, StatutExpressionBesoin statut);

    @Query("""
        SELECT COUNT(e) FROM ExpressionBesoin e
        WHERE e.statut = sn.isra.seed.order_service.entity.enums.StatutExpressionBesoin.SOUMISE
        """)
    long countSoumises();
}
