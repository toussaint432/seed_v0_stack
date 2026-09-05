package sn.isra.seed.stock_service.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sn.isra.seed.stock_service.entity.Stock;
import sn.isra.seed.stock_service.exception.InsufficientStockException;
import sn.isra.seed.stock_service.repo.SiteRepo;
import sn.isra.seed.stock_service.repo.StockRepo;
import sn.isra.seed.stock_service.service.StockTransferService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Consommateur Kafka — événements LOT_TRANSFER_ACCEPTE.
 *
 * Rôle : synchroniser le stock physique (quantite_disponible) entre les deux sites
 * lorsqu'un transfert de lot semencier est accepté par le destinataire.
 *
 * Règle FIFO appliquée côté source :
 *   - Le stock source est identifié par le premier enregistrement créé (createdAt ASC),
 *     conformément à la règle Premier Entré, Premier Sorti.
 *
 * Résolution du site destination :
 *   - Si siteCode explicite fourni dans le payload → utilisé directement (cas normal).
 *   - Sinon → résolution automatique par type d'organisation du rôle destinataire (fallback).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotTransferConsumer {

    private static final Map<String, String> ROLE_TO_ORG_TYPE = Map.of(
        "seed-upsemcl",       "UPSEMCL",
        "seed-multiplicator", "MULTIPLICATEUR",
        "seed-quotataire",    "DISTRIBUTEUR",
        "seed-admin",         "CNRA"
    );

    private final StockRepo            stockRepo;
    private final SiteRepo             siteRepo;
    private final StockTransferService stockTransferService;
    private final ObjectMapper         om;

    @SuppressWarnings("unchecked")
    @Transactional
    @KafkaListener(topics = "lot.transfer.accepte", groupId = "stock-service-lot-consumer")
    public void onLotTransferAccepte(String message) {
        try {
            Map<String, Object> payload = om.readValue(message, Map.class);
            Long       idLot            = ((Number) payload.get("idLot")).longValue();
            BigDecimal quantite         = new BigDecimal(payload.get("quantite").toString());
            String     unite            = (String) payload.getOrDefault("unite", "kg");
            String     codeTransfert    = (String) payload.get("codeTransfert");
            String     roleDestinataire = (String) payload.get("roleDestinataire");
            // siteCode explicite : fourni par le destinataire lors de l'acceptation
            String     siteCodeExplicite = (String) payload.get("siteCode");

            // Résolution du site source : règle FIFO — on prend le stock le plus ancien (premier entré)
            List<Stock> sources = stockRepo.findPositiveByIdLot(idLot);
            if (sources.isEmpty()) {
                log.warn("LotTransferConsumer : aucun stock positif pour lot {} — transfert {} ignoré",
                         idLot, codeTransfert);
                return;
            }
            // Premier élément = plus ancien stock (ORDER BY createdAt ASC dans findPositiveByIdLot)
            String srcSite = sources.get(0).getSite().getCodeSite();

            // Résolution du site destination :
            //   1er choix : siteCode explicitement fourni par le destinataire lors de l'acceptation
            //   2e choix  : résolution automatique par type d'organisation (fallback)
            String destSite;
            if (siteCodeExplicite != null && !siteCodeExplicite.isBlank()) {
                // Cas standard : l'UPSemCL / multiplicateur a sélectionné son site d'entrée
                destSite = siteCodeExplicite;
            } else {
                // Fallback : on cherche le premier site actif correspondant au type d'org du rôle destinataire
                String orgType = ROLE_TO_ORG_TYPE.get(roleDestinataire);
                if (orgType == null) {
                    log.warn("LotTransferConsumer : rôle destinataire inconnu '{}' pour transfert {}",
                             roleDestinataire, codeTransfert);
                    return;
                }
                destSite = siteRepo.findCodeSiteByOrgType(orgType).orElse(null);
                if (destSite == null) {
                    log.warn("LotTransferConsumer : aucun site actif pour org type '{}' (transfert {})",
                             orgType, codeTransfert);
                    return;
                }
            }

            log.info("LotTransferConsumer : lot={} {} FIFO {} → {} qte={}{}",
                     idLot, codeTransfert, srcSite, destSite, quantite, unite);
            stockTransferService.appliquer(idLot, srcSite, destSite, quantite, unite, codeTransfert);

        } catch (InsufficientStockException e) {
            log.error("LotTransferConsumer : stock insuffisant — {}", e.getMessage());
        } catch (Exception e) {
            log.error("LotTransferConsumer : erreur traitement message Kafka : {}", e.getMessage(), e);
        }
    }
}
