# Seed Management Platform (V0) — React + Tailwind / Spring Boot / PostgreSQL / Keycloak / Kafka / Docker / Jenkins

This is a **V0 (minimal but complete)** implementation scaffold for a seed management platform (ISRA-like workflow):
- Varieties (variétés), species (espèces)
- Seed lots (lots semenciers) with **generation** (G0..R2) and **parent lot link**
- Stock per site + stock movements
- Orders (commandes) + allocation to lots
- **Microservices** (REST) + **Kafka events**
- **Security**: Keycloak (OAuth2) + JWT validation in services
- **CI/CD**: Jenkins pipeline
- **Containerization**: Docker + docker-compose
- **Versioning**: Git (repo layout ready)

> V0 goal: run locally with Docker, test the end-to-end scenario (G0 -> create G1 -> stock -> transfer/movement -> order).

---

## 1) Quick start (Docker)

### Prerequisites
- Docker + Docker Compose

### Run
```bash
docker compose up -d --build
```

### URLs
- Frontend: http://localhost:5173
- Keycloak: http://localhost:8080
- Kafka UI: http://localhost:8085
- Catalog Service (Swagger): http://localhost:8081/swagger-ui.html
- Lot Service (Swagger): http://localhost:8082/swagger-ui.html
- Stock Service (Swagger): http://localhost:8083/swagger-ui.html
- Order Service (Swagger): http://localhost:8084/swagger-ui.html

---

## 2) Keycloak (V0 realm)
A ready-to-import realm is provided: `infra/keycloak/realm-seed-v0.json`.
The docker-compose imports it automatically.

### Users (V0)
- **admin** / admin123 (realm role: `seed-admin`)
- **agent** / agent123 (realm role: `seed-operator`)
- **multiplicateur** / multi123 (realm role: `seed-multiplicator`)
- **op** / op123 (realm role: `seed-client`)

Frontend uses **Authorization Code + PKCE** (public client).
Backend services validate JWTs (resource server).

---

## 3) Test scenario (end-to-end)
See: `docs/scenario_test.md`

---

## 4) Repo structure
```
frontend/                 React + Tailwind (Vite)
services/
  catalog-service/        species + varieties
  lot-service/            seed lots (G0..R2 + parent lot)
  stock-service/          stock + movements
  order-service/          orders + allocation
infra/
  postgres/init/          SQL init + seed data
  keycloak/               realm import
  kafka-ui/               kafka ui config
docs/
  scenario_test.md
  api_contracts.md
Jenkinsfile
docker-compose.yml
```

---

## 5) Local dev (without Docker)
You can run Postgres/Keycloak/Kafka via Docker and run services locally:
- Each service: `mvn spring-boot:run`
- Frontend: `npm i && npm run dev`

Set env vars as in docker-compose.

---

## 6) Notes
- V0 keeps the model intentionally **simple** but ready to extend (certification, inspections, validation workflows, quotas, reporting).
- Database schema is in `infra/postgres/init/01_schema.sql` and demo data in `02_seed_data.sql`.
