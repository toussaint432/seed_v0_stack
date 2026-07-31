package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface LotRepo extends JpaRepository<LotSemencier, Long> {

    Optional<LotSemencier> findByCodeLot(String codeLot);
    List<LotSemencier> findByGeneration_CodeGeneration(String codeGeneration);
    List<LotSemencier> findByIdVariete(Long idVariete);

    /**
     * Lots G0+G1 d'un sélectionneur : uniquement ceux qu'il a créés, filtrés par spécialisation.
     * :specialisation doit être passé en MAJUSCULES (UPPER() sur un null non typé échoue en PG).
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G0','G1')
          AND l.usernameCreateur = :username
          AND (:specialisation IS NULL OR UPPER(l.codeEspece) = :specialisation)
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    List<LotSemencier> findForSelector(@Param("username") String username,
                                       @Param("specialisation") String specialisation);

    /**
     * Catalogue G3 visible par les multiplicateurs.
     * Retourne uniquement les lots G3 DISPONIBLES avec quantité > 0.
     * Les lots épuisés (quantiteNette = 0) sont exclus — inutiles pour commander.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'G3'
          AND l.statutLot = :statut
          AND l.quantiteNette > 0
        ORDER BY l.dateProduction DESC, l.createdAt DESC
        """)
    List<LotSemencier> findCatalogueG3(@Param("statut") StatutLot statut);

    /**
     * Lots du multiplicateur : ceux qu'il a produits (idOrgProducteur = orgId)
     * ET ceux qu'il a reçus via un transfert accepté (TransfertLot.statut = ACCEPTE).
     * Couvre G3 reçu + G4, R1, R2 produits par l'org.
     *
     * Note : ORDER BY sur colonne directe du lot uniquement.
     * ORDER BY l.generation.ordreGeneration causait une erreur PostgreSQL :
     * "for SELECT DISTINCT, ORDER BY expressions must appear in select list"
     * car la colonne joinée (ordre_generation) n'est pas dans le SELECT DISTINCT.
     * Le tri par génération est délégué au frontend.
     */
    @Query("""
        SELECT DISTINCT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G3','G4','R1','R2')
          AND (
              l.idOrgProducteur = :orgId
              OR l.id IN (
                  SELECT t.idLot FROM TransfertLot t
                  WHERE t.usernameDestinataire = :username
                    AND t.statut = sn.isra.seed.lot_service.entity.enums.StatutTransfert.ACCEPTE
              )
          )
        ORDER BY l.createdAt DESC
        """)
    List<LotSemencier> findMesLots(@Param("orgId") Long orgId, @Param("username") String username);

    /**
     * Lots R2 disponibles visibles par les quotataires pour passer commande.
     * Seuls les lots de génération R2, statut DISPONIBLE, avec quantité > 0
     * sont exposés — les quotataires ne doivent pas voir G3/G4/R1.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'R2'
          AND l.statutLot = 'DISPONIBLE'
          AND l.quantiteNette > 0
        ORDER BY l.createdAt DESC
        """)
    List<LotSemencier> findR2Disponible();

    /**
     * Lots G4/R1/R2 des multiplicateurs dont le certificat est uploadé mais
     * non encore validé (statut EN_ATTENTE) — file de travail UPSemCL / Admin.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.statutCertification = sn.isra.seed.lot_service.entity.enums.StatutCertification.EN_ATTENTE
          AND l.generation.codeGeneration IN ('G4','R1','R2')
        ORDER BY l.createdAt DESC
        """)
    List<LotSemencier> findLotsACertifier();

    /**
     * Lots G4/R1/R2 produits par UN multiplicateur spécifique (isolation individuelle).
     * Utilisé exclusivement par la vue Contrôle & Certification côté multiplicateur.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.usernameCreateur = :username
          AND l.generation.codeGeneration IN ('G4','R1','R2')
        ORDER BY l.statutCertification ASC, l.createdAt DESC
        """)
    List<LotSemencier> findMesLotsCertif(@Param("username") String username);

    /**
     * Tous les lots G4/R1/R2 de multiplicateurs — vue complète pour l'onglet
     * de certification (UPSemCL / Admin), tous statuts confondus.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G4','R1','R2')
        ORDER BY l.statutCertification ASC, l.createdAt DESC
        """)
    List<LotSemencier> findAllCertifiables();

    /** Débite la quantité nette du lot parent lors de la création d'un lot enfant. */
    @Modifying
    @Query("UPDATE LotSemencier l SET l.quantiteNette = l.quantiteNette - :qte WHERE l.id = :id")
    int debitQuantiteNette(@Param("id") Long id, @Param("qte") BigDecimal qte);
}
