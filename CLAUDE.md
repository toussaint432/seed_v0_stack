# Instructions Claude Code — Sen Jiw

## Langue
Toujours répondre en **français**.

## Commits git
- Ne JAMAIS ajouter de ligne `Co-Authored-By` dans les messages de commit
- Ne JAMAIS mentionner Claude, Anthropic ou un assistant IA dans les commits
- Les commits appartiennent uniquement à **Toussaint GOMIS** (toussaint432)

## Style de code
- Backend : Spring Boot 3.3 / Java 21, annotations Lombok, Spring Security RBAC
- Frontend : React 18 + TypeScript strict, CSS custom (pas de Tailwind)
- Pas de commentaires évidents — uniquement si le WHY est non trivial

## Contexte projet
Plateforme Sen Jiw — gestion de la chaîne semencière ISRA/CNRA Bambey.
Microservices : catalog (:18081), lot (:18082), stock (:18083), order (:18084).
Realm Keycloak : seed-v0. Base PostgreSQL : seed (partagée).
