-- Création des bases supplémentaires nécessaires au démarrage de la stack.
-- Ce script s'exécute avant 01_schema.sql au premier lancement du conteneur postgres.

SELECT 'CREATE DATABASE keycloak OWNER seed'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')
\gexec
