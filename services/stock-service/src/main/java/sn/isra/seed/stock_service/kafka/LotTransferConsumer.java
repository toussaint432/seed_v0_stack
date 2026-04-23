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
 * Consomme les événements LOT_TRANSFER_ACCEPTE publiés par le lot-service
 * et synchronise le stock physique (quantite_disponible) entre les deux sites.
 *
 * Résolution des sites :
 *   - source      : premier site ayant du stock positif pour ce lot (EAGER fetch)
 *   - destination : premier site actif de l'org correspondant au rôle destinataire
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotTransferConsumer {

    private static final Map<String, String> ROLE_TO_ORG_TYPE = Map.of(
        "ROLE_UPSEMCL",        "UPSEMCL",
        "ROLE_MULTIPLICATEUR", "MULTIPLICATEUR",
        "ROLE_DISTRIBUTEUR",   "DISTRIBUTEUR",
        "ROLE_DETAILLANT",     "DETAILLANT"
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

            // Résolution site source — premier stock positif pour ce lot (site EAGER)
            List<Stock> sources = stockRepo.findPositiveByIdLot(idLot);
            if (sources.isEmpty()) {
                log.warn("LotTransferConsumer : aucun stock positif pour lot {} — transfert {} ignoré",
                         idLot, codeTransfert);
                return;
            }
            String srcSite = sources.get(0).getSite().getCodeSite();

            // Résolution site destination — org type lié au rôle destinataire
            String orgType = ROLE_TO_ORG_TYPE.get(roleDestinataire);
            if (orgType == null) {
                log.warn("LotTransferConsumer : rôle destinataire inconnu '{}' pour transfert {}",
                         roleDestinataire, codeTransfert);
                return;
            }
            String destSite = siteRepo.findCodeSiteByOrgType(orgType).orElse(null);
            if (destSite == null) {
                log.warn("LotTransferConsumer : aucun site actif pour org type '{}' (transfert {})",
                         orgType, codeTransfert);
                return;
            }

            log.info("LotTransferConsumer : lot={} {} {} → {} qte={}{}",
                     idLot, codeTransfert, srcSite, destSite, quantite, unite);
            stockTransferService.appliquer(idLot, srcSite, destSite, quantite, unite, codeTransfert);

        } catch (InsufficientStockException e) {
            log.error("LotTransferConsumer : stock insuffisant — {}", e.getMessage());
        } catch (Exception e) {
            log.error("LotTransferConsumer : erreur traitement message Kafka : {}", e.getMessage(), e);
        }
    }
}
