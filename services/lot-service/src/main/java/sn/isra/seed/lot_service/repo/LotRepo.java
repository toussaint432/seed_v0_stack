package sn.isra.seed.lot_service.repo;

import sn.isra.seed.lot_service.entity.LotSemencier;
import sn.isra.seed.lot_service.entity.enums.StatutEdition;
import sn.isra.seed.lot_service.entity.enums.StatutLot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface LotRepo extends JpaRepository<LotSemencier, Long> {

    Optional<LotSemencier> findByCodeLot(String codeLot);
    List<LotSemencier> findByGeneration_CodeGeneration(String codeGeneration);
    List<LotSemencier> findByIdVariete(Long idVariete);

    // Variantes paginées
    Page<LotSemencier> findByGeneration_CodeGeneration(String codeGeneration, Pageable pageable);
    Page<LotSemencier> findByIdVariete(Long idVariete, Pageable pageable);

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

    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G0','G1')
          AND l.usernameCreateur = :username
          AND (:specialisation IS NULL OR UPPER(l.codeEspece) = :specialisation)
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    Page<LotSemencier> findForSelector(@Param("username") String username,
                                       @Param("specialisation") String specialisation,
                                       Pageable pageable);

    /**
     * Catalogue G3 visible par les multiplicateurs.
     * Retourne uniquement les lots G3 DISPONIBLES avec quantité > 0.
     * Exclut les lots de réception (code REC-*) créés lors des livraisons aux multiplicateurs :
     * ceux-ci appartiennent à "Mes Lots" du multiplicateur, pas au catalogue UPSemCL.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'G3'
          AND l.statutLot = :statut
          AND l.quantiteNette > 0
          AND l.codeLot NOT LIKE 'REC-%'
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
    Page<LotSemencier> findMesLots(@Param("orgId") Long orgId, @Param("username") String username,
                                   Pageable pageable);

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

    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'R2'
          AND l.statutLot = 'DISPONIBLE'
          AND l.quantiteNette > 0
        ORDER BY l.createdAt DESC
        """)
    Page<LotSemencier> findR2Disponible(Pageable pageable);

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

    /**
     * Catalogue G1 visible par l'UPSemCL.
     * Retourne tous les lots G1 DISPONIBLES avec quantité > 0 produits par les sélectionneurs.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration = 'G1'
          AND l.statutLot = :statut
          AND l.quantiteNette > 0
          AND l.responsableRole = 'seed-selector'
        ORDER BY l.codeEspece ASC NULLS LAST, l.dateProduction DESC, l.createdAt DESC
        """)
    List<LotSemencier> findCatalogueG1(@Param("statut") StatutLot statut);

    /**
     * Lots G1/G2/G3 de l'UPSemCL : lots dont l'org est productrice (y compris REC créés à l'acceptation).
     * Remplace findAll() non filtré utilisé jusqu'ici pour seed-upsemcl.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G1','G2','G3')
          AND l.idOrgProducteur = :orgId
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    Page<LotSemencier> findLotsUpsemcl(@Param("orgId") Long orgId, Pageable pageable);

    /**
     * Tous les lots G1/G2/G3 de l'UPSemCL — sans pagination.
     * Utilisé par GET /mes-lots pour éviter la troncature à 20 résultats
     * qui masquait les lots G3 quand G1+G2 remplissaient déjà la première page.
     */
    @Query("""
        SELECT l FROM LotSemencier l
        WHERE l.generation.codeGeneration IN ('G1','G2','G3')
          AND l.idOrgProducteur = :orgId
        ORDER BY l.generation.ordreGeneration ASC, l.createdAt DESC
        """)
    List<LotSemencier> findLotsUpsemclAll(@Param("orgId") Long orgId);

    /** Débite la quantité nette du lot parent lors de la création d'un lot enfant. */
    @Modifying
    @Query("UPDATE LotSemencier l SET l.quantiteNette = l.quantiteNette - :qte WHERE l.id = :id")
    int debitQuantiteNette(@Param("id") Long id, @Param("qte") BigDecimal qte);

    /** Agrégats par génération — sans pagination — pour les cartes pipeline du frontend. */
    @Query("""
        SELECT l.generation.codeGeneration,
               COUNT(l),
               SUM(COALESCE(l.quantiteNette, 0))
        FROM LotSemencier l
        GROUP BY l.generation.codeGeneration
        ORDER BY l.generation.codeGeneration
        """)
    List<Object[]> statsParGeneration();

    @Query("SELECT l FROM LotSemencier l WHERE l.statutEdition = :statut AND l.createdAt < :limite")
    List<LotSemencier> findBrouillonsAnciensDe(
        @Param("limite") java.time.Instant limite,
        @Param("statut") StatutEdition statut
    );
}
