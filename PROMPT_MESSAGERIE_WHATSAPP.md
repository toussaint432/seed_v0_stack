# PROMPT POUR CLAUDE CODE — Messagerie WhatsApp-style

Lis d'abord le fichier PROMPT_MAITRE_V1.4.md à la racine du projet pour comprendre le contexte complet.

## CE QUE JE VEUX

Remplacer le système de messagerie email-style par une messagerie WhatsApp-style pour les quotataires et multiplicateurs. Le quotataire doit pouvoir :

1. Voir la liste des multiplicateurs (avec stock dispo + distance si GPS)
2. Taper sur un multiplicateur → ouvrir un chat direct instantanément
3. Discuter en texte + audio (hold-to-record) + image
4. Passer commande DEPUIS LE CHAT (bouton "Commander" dans la conversation)

Le multiplicateur voit ses conversations + les commandes reçues au même endroit.

## ARCHITECTURE TECHNIQUE

### Base de données (dans PostgreSQL seed, même base partagée)

```sql
-- Table conversation (pas de sujet, pas d'email — juste 2 participants)
CREATE TABLE IF NOT EXISTS conversation (
  id BIGSERIAL PRIMARY KEY,
  participant_1 VARCHAR(150) NOT NULL,  -- keycloak username
  participant_2 VARCHAR(150) NOT NULL,
  dernier_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- Table message (type WhatsApp : texte, audio, image, commande)
CREATE TABLE IF NOT EXISTS message (
  id BIGSERIAL PRIMARY KEY,
  id_conversation BIGINT NOT NULL REFERENCES conversation(id),
  expediteur VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'TEXT'
    CHECK (type IN ('TEXT','AUDIO','IMAGE','COMMANDE')),
  contenu TEXT,              -- texte du message OU JSON de la commande
  url_media TEXT,            -- URL du fichier audio/image (stockage local ou MinIO)
  nom_fichier VARCHAR(255),
  taille_fichier INTEGER,
  lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
  -- JAMAIS de suppression : messages auditables
);

CREATE INDEX IF NOT EXISTS idx_msg_conv_date ON message(id_conversation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_non_lu ON message(id_conversation, lu) WHERE lu = FALSE;
```

Le type 'COMMANDE' est un message spécial : le contenu est un JSON avec les détails de la commande (variété, quantité, lot). Il s'affiche comme une carte dans le chat, comme les messages de paiement WhatsApp.

### Backend — Ajouter dans order-service (port 18084)

Pourquoi order-service ? Parce que les conversations sont liées aux commandes et les organisations (membre_organisation) y sont déjà. Pas besoin d'un messaging-service séparé en V1.

**Entités Java à créer :**
- `Conversation.java` dans order-service/entity/
- `Message.java` dans order-service/entity/

**Repos :**
- `ConversationRepo.java` : findByParticipant1OrParticipant2(), findByParticipant1AndParticipant2()
- `MessageRepo.java` : findByIdConversationOrderByCreatedAtDesc(), countByIdConversationAndLuFalseAndExpediteurNot()

**Controller : `ChatController.java`**

```
GET  /api/chat/conversations
  → Retourne les conversations de l'utilisateur connecté (extrait du JWT)
  → Chaque conversation inclut : l'autre participant (nom, organisation, rôle),
    le dernier message, le nombre de non-lus
  → Trié par dernier_message_at DESC

POST /api/chat/conversations
  Body : { destinataireUsername: "multiplicateur" }
  → Crée ou retrouve une conversation existante
  → Validation : le quotataire ne peut contacter que des multiplicateurs
    (vérifier le rôle du destinataire via membre_organisation)

GET  /api/chat/conversations/{id}/messages?page=0&size=30
  → Messages paginés, du plus récent au plus ancien
  → Marque automatiquement comme lus les messages reçus

POST /api/chat/conversations/{id}/messages
  Body : { type: "TEXT", contenu: "Bonjour, avez-vous du Souna 3 ?" }
  → Enregistre le message
  → Met à jour conversation.dernier_message_at

POST /api/chat/conversations/{id}/messages
  Body : { type: "COMMANDE", contenu: '{"idLot":5,"quantite":500,"unite":"kg","notes":"Livraison Kaffrine"}' }
  → Crée le message type COMMANDE
  → Crée aussi l'entrée dans la table commande existante
  → Le multiplicateur voit une carte commande dans le chat

POST /api/chat/conversations/{id}/messages/upload
  → Multipart : fichier audio ou image
  → Stockage dans le dossier Docker /uploads/chat/ (simple pour V1, MinIO plus tard)
  → Audio : accepter audio/webm, audio/mp4, audio/mpeg (max 2 Mo)
  → Image : accepter image/jpeg, image/png, image/webp (max 5 Mo)

GET  /api/chat/unread-count
  → Retourne le total de messages non lus pour le badge navbar
```

**Sécurité :**
- Tous les endpoints protégés par JWT
- Un utilisateur ne peut accéder qu'à SES conversations
- Le quotataire ne peut écrire qu'à des multiplicateurs
- Le multiplicateur peut écrire aux quotataires ET aux UPSemCL
- L'UPSemCL peut écrire aux multiplicateurs ET aux sélectionneurs

### Frontend — Nouvelles pages et composants

**1. Page `Messages.tsx`** — la page principale de messagerie

Pattern mobile-first (comme WhatsApp) :
- Sur mobile (< 768px) : 2 vues séparées
  - Vue 1 : liste des conversations (avatar, nom, dernier message, heure, badge non-lu)
  - Au tap → Vue 2 : fil de messages avec bouton retour
- Sur desktop (≥ 768px) : layout split (liste à gauche 320px, chat à droite)

Liste des conversations :
- Chaque ligne : avatar (initiales), nom + organisation, aperçu dernier message, heure, badge non-lu
- Bouton "Nouveau message" en haut → ouvre la liste des multiplicateurs
- Trié par dernier message (plus récent en haut)

Fil de messages (zone de chat) :
- Header : nom du contact + organisation + bouton retour (mobile)
- Bulles : mes messages à droite (vert), ses messages à gauche (gris)
- Types de bulles :
  - TEXT : bulle texte simple
  - AUDIO : player audio HTML5 avec barre de progression
  - IMAGE : miniature cliquable → lightbox plein écran
  - COMMANDE : carte spéciale avec détails (variété, quantité, prix) + statut

Zone de saisie en bas :
- Input texte extensible + bouton envoyer
- Bouton microphone : HOLD pour enregistrer, RELEASE pour envoyer
  ```typescript
  // Encoder en Opus/WebM (50 Ko pour 30s au lieu de 5 Mo en WAV)
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4'  // fallback iOS
  });
  ```
- Bouton image : ouvre le sélecteur de fichiers
- Bouton "Commander" (icône panier) : ouvre un mini-formulaire inline
  → Sélection lot, quantité, notes → Envoie un message type COMMANDE

Polling : GET messages toutes les 3 secondes sur la conversation active.
Badge navbar : GET unread-count toutes les 30 secondes.

**2. Composant `ChatBubble.tsx`** — rendu d'un message

```tsx
// Props : { message, isMine }
// Rendu selon message.type :
// TEXT → bulle texte
// AUDIO → <audio> player
// IMAGE → <img> miniature cliquable
// COMMANDE → carte avec icône panier, variété, quantité, statut
```

**3. Composant `AudioRecorder.tsx`** — hold-to-record

```tsx
// État : idle | recording | sending
// onMouseDown / onTouchStart → démarre l'enregistrement (dot rouge pulsant)
// onMouseUp / onTouchEnd → arrête et envoie
// Animation : cercle rouge pulsant pendant l'enregistrement
// Annulation : glisser vers la gauche (optionnel V1)
```

**4. Modification `CataloguePublic.tsx` (ou Dashboard quotataire)**

Ajouter un bouton "Contacter" sur chaque card multiplicateur :
- Le bouton crée/ouvre la conversation avec ce multiplicateur
- Redirige vers Messages.tsx avec la conversation ouverte

**5. Modification `App.tsx`**

- Ajouter la page 'messages' dans le type Page
- Ajouter la route dans getNavSections :
  - Pour seed-quotataire : ajouter dans la section "Commandes"
  - Pour seed-multiplicator : ajouter dans la section "Gestion"
  - Pour seed-upseml : ajouter dans la section "Gestion"
  - Pour seed-selector : ajouter dans la section "Transferts"
- Icône : MessageCircle de lucide-react
- Badge non-lu à côté du label "Messages"

**6. Modification `endpoints.ts`**

Ajouter :
```typescript
// Chat (order-service :18084)
chatConversations:    `${ORDER}/chat/conversations`,
chatMessages:   (convId: number) => `${ORDER}/chat/conversations/${convId}/messages`,
chatUpload:     (convId: number) => `${ORDER}/chat/conversations/${convId}/messages/upload`,
chatUnread:     `${ORDER}/chat/unread-count`,
```

### Design — Respect du système existant

- Utiliser les classes CSS existantes : card, btn-primary, badge, etc.
- Font : Outfit (déjà configuré)
- Couleurs :
  - Mes bulles : background #dcfce7 (vert clair, comme WhatsApp)
  - Ses bulles : background var(--surface) (gris clair)
  - Bulles commande : background #fef9ed avec bordure dorée
- Bouton enregistrement : rond rouge pulsant
- Zones tactiles ≥ 44px × 44px (mobile-first)
- Langue : Français exclusivement

### Docker — Stockage fichiers

Pour la V1, stocker les fichiers audio/image dans un volume Docker :
```yaml
# Ajouter dans docker-compose.yml pour order-service
volumes:
  - seed_chat_uploads:/app/uploads/chat
```

Le controller sert les fichiers via :
```
GET /api/chat/files/{filename}
```

En V2, migrer vers MinIO.

### Ordre d'implémentation

1. Migration SQL (conversation + message)
2. Entités Java + Repos + ChatController dans order-service
3. Rebuild order-service, tester avec curl
4. Créer ChatBubble.tsx + AudioRecorder.tsx
5. Créer Messages.tsx (page complète)
6. Modifier App.tsx (route + nav)
7. Modifier endpoints.ts
8. Rebuild frontend, tester visuellement
9. Ajouter le bouton "Contacter" dans le catalogue quotataire

### Tests à effectuer

```bash
# Créer une conversation quotataire → multiplicateur
curl -s -X POST http://localhost:18084/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN_QUOT" \
  -H "Content-Type: application/json" \
  -d '{"destinataireUsername": "multiplicateur"}'

# Envoyer un message texte
curl -s -X POST http://localhost:18084/api/chat/conversations/1/messages \
  -H "Authorization: Bearer $TOKEN_QUOT" \
  -H "Content-Type: application/json" \
  -d '{"type": "TEXT", "contenu": "Bonjour, avez-vous du Souna 3 ?"}'

# Le multiplicateur lit les messages
curl -s http://localhost:18084/api/chat/conversations/1/messages \
  -H "Authorization: Bearer $TOKEN_MULTI"

# Envoyer une commande via le chat
curl -s -X POST http://localhost:18084/api/chat/conversations/1/messages \
  -H "Authorization: Bearer $TOKEN_QUOT" \
  -H "Content-Type: application/json" \
  -d '{"type": "COMMANDE", "contenu": "{\"idLot\":5,\"quantite\":500,\"unite\":\"kg\",\"notes\":\"Livraison Kaffrine\"}"}'

# Vérifier les non-lus
curl -s http://localhost:18084/api/chat/unread-count \
  -H "Authorization: Bearer $TOKEN_MULTI"

# Test sécurité : quotataire ne peut PAS contacter un sélectionneur
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:18084/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN_QUOT" \
  -H "Content-Type: application/json" \
  -d '{"destinataireUsername": "selecteur"}'
# ATTENDU : 403
```

Tests visuels :
```
✅ Quotataire : sidebar montre "Messages" avec badge non-lu
✅ Cliquer → liste des conversations (ou vide si première fois)
✅ "Nouveau message" → liste des multiplicateurs avec stock
✅ Taper sur un multiplicateur → chat s'ouvre
✅ Écrire un texte → bulle verte à droite
✅ Le multiplicateur voit la bulle grise à gauche
✅ Hold micro → enregistrement (dot rouge) → release → bulle audio
✅ Envoyer image → bulle image avec miniature
✅ Bouton "Commander" → mini-formulaire → carte commande dans le chat
✅ Sur mobile (375px) : navigation liste ↔ chat avec bouton retour
✅ Sur desktop : split layout liste + chat
✅ Badge non-lu se met à jour
```

## CONTRAINTES IMPORTANTES

- Ne JAMAIS casser les pages existantes (Dashboard, Lots, Stocks, etc.)
- Utiliser les composants existants (Modal, Toast, FormInput, etc.)
- Pas de suppression physique de messages (audit)
- Les messages type COMMANDE créent aussi une entrée dans la table commande existante
- TypeScript strict
- Même pattern CSS (pas de nouveau framework)
- Commencer par le SQL, puis le backend, puis le frontend — tester à chaque étape
