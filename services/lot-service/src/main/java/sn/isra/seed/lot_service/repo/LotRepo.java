package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LotRepo extends JpaRepository<LotSemencier, Long> {

    Optional<LotSemencier> findByCodeLot(String codeLot);
    List<LotSemencier> findByGeneration_CodeGeneration(String codeGeneration);
    List<LotSemencier> findByIdVariete(Long idVariete);

    /**
     * Lots G0+G1 d'un sélectionneur, filtrés par spécialisation espèce.
     * Si specialisation est null → retourne tous les G0+G1 (pas de restriction).
     * Utilise le champ dénormalisé code_espece pour éviter un appel inter-service.
     */
    /**
     * Note : le paramètre :specialisation doit être passé en MAJUSCULES depuis le contrôleur.
     * On évite UPPER(:specialisation) car PostgreSQL ne peut pas inférer le type d'un null
     * non typé (erreur "function upper(bytea) does not exist").
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G0','G1')
          AND (:specialisation IS NULL OR UPPER(l.codeEspece) = :specialisation)
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    List<LotSemencier> findForSelector(@Param("specialisation") String specialisation);

    /**
     * Catalogue G3 visible par les multiplicateurs.
     * Retourne les lots G3 DISPONIBLES, triés par date de production DESC.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'G3'
          AND l.statutLot = :statut
        ORDER BY l.dateProduction DESC, l.createdAt DESC
        """)
    List<LotSemencier> findCatalogueG3(@Param("statut") StatutLot statut);

    /**
     * Lots appartenant à une organisation spécifique (multiplicateur).
     * Couvre G3 reçu + G4, R1, R2 produits par l'org.
     * Tri : génération ASC (G3→R2) puis date DESC.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.idOrgProducteur = :orgId
          AND l.generation.codeGeneration IN ('G3','G4','R1','R2')
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    List<LotSemencier> findMesLots(@Param("orgId") Long orgId);
}
