# Contrats d'API (V0)

Tous les services sont protégés via JWT Keycloak.

## Auth
Frontend obtient un access token via Keycloak (OIDC).
Backend valide via `issuer-uri`.

---

## catalog-service (8081)
- GET /api/species
- GET /api/varieties
- POST /api/varieties (admin/operator)

## lot-service (8082)
- GET /api/lots?generation=G0
- POST /api/lots
- POST /api/lots/{id}/child (crée un lot enfant)

Kafka:
- lot.created

## stock-service (8083)
- GET /api/stocks?site=...
- POST /api/stocks (upsert)
- POST /api/movements (entrée/sortie/transfert)

Kafka:
- stock.updated
- stock.moved

## order-service (8084)
- GET /api/orders
- POST /api/orders
- POST /api/orders/{id}/allocate (allocation au lot)

Kafka:
- order.created
