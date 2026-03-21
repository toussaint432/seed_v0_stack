# Scénario de test V0 (E2E)

## Pré-requis
- `docker compose up -d --build`

## 0) Connexion
Ouvrir http://localhost:5173  
Se connecter via Keycloak.
- admin/admin123 (profil admin)

## 1) Vérifier les référentiels
Menu **Référentiels**
- Espèces (ex: arachide)
- Variétés (ex: ARA-12 / Fleur 11)

## 2) Vérifier l'existence d'un lot G0
Menu **Lots**
- Rechercher `G0`
- Lot attendu: `LOT-ARA12-G0-2026-001` (stock initial)

## 3) Créer un lot G1 à partir de G0
Menu **Lots** > bouton **Créer lot enfant**
- Parent: `LOT-ARA12-G0-2026-001`
- Génération cible: `G1`
- Campagne: `HIV-2027`
- Quantité nette: 350 kg

Résultat:
- nouveau lot `LOT-ARA12-G1-2027-001`
- Event Kafka `lot.created` publié

## 4) Créer/mettre à jour le stock du lot G1
Menu **Stock**
- Site: `MAG-THIES`
- Lot: `LOT-ARA12-G1-2027-001`
- Quantité: 350 kg

Résultat:
- Stock affiché
- Event Kafka `stock.updated` publié

## 5) Effectuer un mouvement/transfert vers un multiplicateur
Menu **Stock** > **Mouvement**
- Type: TRANSFER
- Source site: `MAG-THIES`
- Destination site: `FERME-MULTI-01`
- Quantité: 100 kg

Résultat:
- stock source décrémenté
- stock destination incrémenté
- Event Kafka `stock.moved` publié

## 6) Passer une commande (OP)
Se connecter avec `op/op123`
Menu **Commandes**
- Créer commande: variété ARA-12 génération R1 (ou G1 pour V0)
- Quantité: 50 kg

Résultat:
- commande créée
- affectation manuelle au lot G1 possible (V0)
- Event Kafka `order.created` publié

## 7) Vérifier les événements Kafka
Kafka UI: http://localhost:8085
Topics:
- `lot.created`
- `stock.updated`
- `stock.moved`
- `order.created`
