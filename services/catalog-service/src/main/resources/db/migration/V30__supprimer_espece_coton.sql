-- Suppression de l'espèce Coton (COT) : aucune variété, aucun lot, aucune commande associée.
-- Les variétés et l'historique espèce sont en CASCADE, mais la table est vide dans les deux cas.
DELETE FROM espece WHERE code_espece = 'COT';
