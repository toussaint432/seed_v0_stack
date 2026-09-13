package sn.isra.seed.order_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import sn.isra.seed.order_service.entity.*;
import sn.isra.seed.order_service.entity.enums.StatutFacture;
import sn.isra.seed.order_service.entity.enums.TypeCommande;
import sn.isra.seed.order_service.entity.enums.TypeFacture;
import sn.isra.seed.order_service.repo.FactureRepo;
import sn.isra.seed.order_service.repo.PropositionLigneRepo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Génération de factures commerciales pour le workflow G3 et R2.
 *
 * Séparé de FactureController pour être injecté dans OrderController
 * lors du déclencheur atomique confirmer-et-transferer (@Transactional).
 *
 * Règle FCFA : tous les montants sont arrondis à l'entier (RoundingMode.HALF_UP).
 * Les colonnes DB sont NUMERIC(14,2) — les valeurs stockées auront toujours .00.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FactureGenerationService {

    private final FactureRepo           factureRepo;
    private final PropositionLigneRepo  propositionLigneRepo;

    /**
     * Génère et persiste la facture d'une commande.
     * Idempotent : si une facture existe déjà pour cette commande, la retourne.
     *
     * @throws ResponseStatusException 409 si aucune ligne n'a de prix renseigné
     */
    public Facture genererFactureAuto(Commande commande, String usernameEmetteur) {
        // Idempotence — ne jamais créer deux factures pour la même commande
        return factureRepo.findByCommande_Id(commande.getId())
                .orElseGet(() -> creerNouvelleFacture(commande, usernameEmetteur));
    }

    private Facture creerNouvelleFacture(Commande commande, String usernameEmetteur) {
        TypeFacture typeFacture = commande.getTypeCommande() == TypeCommande.G3_UPSEMCL_MULT
                ? TypeFacture.INSTITUTIONNELLE
                : TypeFacture.MULTIPLICATEUR;

        String numeroFacture = genererNumero(commande, typeFacture);

        Facture facture = new Facture();
        facture.setCommande(commande);
        facture.setNumeroFacture(numeroFacture);
        facture.setTypeFacture(typeFacture);
        facture.setUsernameEmetteur(usernameEmetteur);
        facture.setStatut(StatutFacture.EMISE);

        BigDecimal totalHt  = BigDecimal.ZERO;
        BigDecimal totalTva = BigDecimal.ZERO;

        for (LigneCommande ligne : commande.getLignes()) {
            PropositionLigne prop = propositionLigneRepo
                    .findByLigneCommande_Id(ligne.getId()).orElse(null);

            if (prop == null || prop.getIdLotSelectionne() == null
                    || prop.getQuantiteSelectionnee() == null) continue;

            if (prop.getPrixUnitaireHt() == null) {
                log.warn("[facture-auto] Ligne #{} sans prix unitaire HT — ignorée (données legacy)", ligne.getId());
                continue;
            }

            BigDecimal tauxTva = prop.getTauxTva() != null
                    ? prop.getTauxTva() : BigDecimal.ZERO;

            // Arrondi FCFA : entier HALF_UP sur chaque ligne
            BigDecimal montantHt = prop.getPrixUnitaireHt()
                    .multiply(prop.getQuantiteSelectionnee())
                    .setScale(0, RoundingMode.HALF_UP);
            BigDecimal montantTva = montantHt
                    .multiply(tauxTva)
                    .divide(new BigDecimal("100"), 0, RoundingMode.HALF_UP);
            BigDecimal montantTtc = montantHt.add(montantTva);

            FactureLigne fl = new FactureLigne();
            fl.setFacture(facture);
            fl.setIdLot(prop.getIdLotSelectionne());
            fl.setQuantite(prop.getQuantiteSelectionnee());
            fl.setUnite(ligne.getUnite() != null ? ligne.getUnite() : "kg");
            fl.setPrixUnitaireHt(prop.getPrixUnitaireHt());
            fl.setTauxTva(tauxTva);
            fl.setMontantHt(montantHt);
            fl.setMontantTtc(montantTtc);
            fl.setGeneration(ligne.getIdGeneration() != null ? genCode(ligne.getIdGeneration()) : null);
            fl.setCreatedAt(Instant.now());

            facture.getLignes().add(fl);
            totalHt  = totalHt.add(montantHt);
            totalTva = totalTva.add(montantTva);
        }

        facture.setMontantHt(totalHt);
        facture.setMontantTva(totalTva);
        facture.setMontantTtc(totalHt.add(totalTva));

        Facture saved = factureRepo.save(facture);
        log.info("[facture-auto] Facture {} générée pour commande {} par {}",
                saved.getNumeroFacture(), commande.getId(), usernameEmetteur);
        return saved;
    }

    private String genererNumero(Commande commande, TypeFacture typeFacture) {
        String prefix = typeFacture == TypeFacture.INSTITUTIONNELLE ? "FACT-ISRA" : "FACT-MUL";
        String annee  = DateTimeFormatter.ofPattern("yyyy")
                .withZone(ZoneId.of("Africa/Dakar"))
                .format(Instant.now());
        return prefix + "-" + annee + "-" + commande.getId() + "-" + System.currentTimeMillis() % 10000;
    }

    private String genCode(Long idGeneration) {
        return switch (idGeneration.intValue()) {
            case 1 -> "G0"; case 2 -> "G1"; case 3 -> "G2"; case 4 -> "G3";
            case 5 -> "G4"; case 6 -> "R1"; case 7 -> "R2"; default -> "G" + idGeneration;
        };
    }
}
