# Plan : 4 axes d'amélioration Colanode

> Document d'analyse uniquement — aucun code n'a été modifié à ce stade.

## Contexte

L'utilisateur souhaite faire évoluer Colanode sur 4 axes :

1. Rendre l'expérience "workspace / space" plus proche de Discord (un espace = un serveur).
2. Ajouter un bloc éditeur `/plantuml` pour visualiser des diagrammes PlantUML directement dans une page.
3. Ajouter un système de notifications (aujourd'hui inexistant malgré des briques partielles).
4. Ajouter une recherche dans le workspace (aujourd'hui inexistante malgré un schéma FTS5 déjà en place et alimenté).

L'exploration du code a confirmé que :
- Le switch entre **workspaces** existe déjà (menu déroulant en haut de la sidebar, `sidebar-menu-header.tsx`) — **on ne touche pas à ça**.
- Le switch entre **spaces** à l'intérieur d'un workspace existe déjà mais sous forme de liste nommée, pas de rail d'icônes permanent — c'est ce point précis qu'on améliore.
- Aucune notion d'"organisation" n'existe et n'est pas nécessaire : `workspace` reste l'unité top-level, `space` (déjà N par workspace) devient l'équivalent "serveur Discord".
- Les mentions, compteurs non-lus et l'indexation FTS5 (`node_texts`/`document_texts`) sont déjà des briques fonctionnelles et alimentées en continu — les features 3 et 4 s'appuient dessus plutôt que de réinventer une infra serveur.

---

## Feature 1 — Rail d'icônes façon Discord pour les spaces

**But** : remplacer la liste nommée de spaces (`packages/ui/src/components/layouts/sidebars/sidebar-spaces.tsx`) par un rail vertical permanent d'icônes (avatar par space), avec le contenu (channels/pages) du space actif affiché à côté — sans toucher au switch de workspace existant.

**Fichiers** :
- `sidebar-spaces.tsx` : restructuré en deux colonnes — nouveau `SpaceRail` (icônes + bouton "+" `SpaceCreateButton` en bas) et un `SpaceContent` (reprend la logique actuelle de `space-sidebar-item.tsx` : header, dropdown, liste des enfants via `sortSpaceChildren`).
- Nouveau `packages/ui/src/components/layouts/sidebars/space-rail.tsx` (ou `spaces/space-rail.tsx`) : live query existante sur `nodes` type `space`, un `Avatar` par space (réutiliser le composant `Avatar` déjà utilisé dans `sidebar-menu-header.tsx`), indicateur actif (style à définir en s'inspirant de `sidebar-menu-icon.tsx`), badge non-lu par space (via `radar.getNodeState(userId, nodeId)`).
- Nouveau `packages/ui/src/components/spaces/space-content.tsx` : contenu du space sélectionné, refactor de `space-sidebar-item.tsx`. **Attention** : `SpaceSidebarItem` est aussi utilisé génériquement par `sidebar-item.tsx` (`SidebarItem`) pour tout node de type `space` — il ne faut pas le supprimer, seulement ajouter un composant sœur.
- Vérifier `sidebar-desktop.tsx`/`sidebar-mobile.tsx`/`sidebar.tsx` pour les largeurs fixes (ajout d'une colonne) — vérification faite : `Sidebar` est un simple flex row sans largeur figée bloquante.

**Données** : aucune migration ni changement de sync — uniquement un état local "space actif". Le menu top-level (`Sidebar`) utilise déjà un `useState` local (pas de persistance URL), donc suivre la même convention. Point ouvert : pas de pattern existant pour lire l'id de node courant depuis l'URL dans un composant non-route — à instrumenter si on veut que le rail mette en avant le bon space sur un deep link.

**Risque** : faible, essentiellement CSS/layout.

---

## Feature 2 — Bloc éditeur `/plantuml` (rendu local WASM/JS)

**But** : commande slash `/plantuml` insérant un bloc dont le texte source est rendu en diagramme, **sans appel réseau externe** (choix explicite de l'utilisateur, cohérent avec l'esprit local-first).

**Pattern à suivre** : identique à `code-block` (`packages/ui/src/editor/extensions/code-block.tsx` + `packages/ui/src/editor/views/code-block.tsx`) — pas de nouveau type de node dans le registry `packages/core`, le texte source vit dans le JSON du document TipTap (`richTextContentSchema`), synchronisé via le pipeline CRDT existant sans aucun changement serveur/schema.

**Fichiers à créer** :
- `packages/ui/src/editor/extensions/plantuml.tsx` — Node TipTap (`content: 'text*'`, `code: true`), `addNodeView()` → `ReactNodeViewRenderer(PlantUmlNodeView)`.
- `packages/ui/src/editor/views/plantuml-block.tsx` — NodeView avec mode édition (textarea/`NodeViewContent` brut, comme code-block) et mode aperçu (SVG rendu), re-render debouncé, gestion d'erreur de syntaxe affichée inline (jamais de crash de l'éditeur), lazy-load du moteur de rendu pour ne pas alourdir le bundle initial.
- `packages/ui/src/editor/commands/plantuml.tsx` — entrée de la commande slash, modelée sur `commands/code-block.tsx`, insère un squelette `@startuml / @enduml` valide.
- Enregistrement dans `packages/ui/src/editor/extensions/index.tsx`, `packages/ui/src/editor/commands/index.tsx`, et branchement dans `packages/ui/src/components/documents/document-editor.tsx` (liste `extensions` + `CommanderExtension.configure({ commands })`).
- `packages/ui/src/editor/classes.ts` — classe CSS dédiée.

**Risque principal à lever avant de coder** : choix réel de la librairie de rendu PlantUML 100% locale/WASM compatible navigateur ET Electron (CSP `wasm-unsafe-eval`, taille de bundle). Aucune librairie de ce type n'est encore identifiée avec certitude dans l'écosystème npm actuel — **faire un spike isolé** (script jetable rendant un `.puml` en SVG) avant d'écrire l'intégration TipTap. Si aucune solution WASM/JS pure n'est viable pour le web, ce sera à trancher (dégradation sur le web vs desktop-only via Node/Java en process principal Electron).

---

## Feature 3 — Notifications (centre in-app, mentions uniquement + notifications desktop Electron)

**But** : centre de notifications persistant et consultable (mentions seulement pour la v1) + notification native OS quand la fenêtre desktop n'est pas au premier plan.

**Constat clé** : les mentions sont déjà détectées **localement sur chaque client** (`packages/core/src/lib/mentions.ts`, `packages/client/src/lib/mentions.ts`) et écrites dans la table locale `node_references`, avec émission d'un event `node.reference.created` sur l'`eventBus` client — que la mention vienne d'une édition locale ou d'une mise à jour synchronisée depuis le serveur. **Aucune nouvelle infra serveur n'est nécessaire** : on construit une table et un service 100% côté client, alimentés par cet event existant.

**Fichiers** :
- Nouvelle migration `packages/client/src/databases/workspace/migrations/000XX-create-notifications-table.ts` (+ typings Kysely dans `schema.ts`) : table `notifications` (`id`, `node_id`, `root_id`, `reference_id`, `actor_id`, `type='mention'`, `created_at`, `read_at` nullable). Nouveau `IdType` à ajouter côté `packages/core`.
- Nouveau `packages/client/src/services/workspaces/notification-service.ts` : écoute `node.reference.created`, filtre sur `referenceId === workspace.userId` (exclure `MentionConstants.Everyone` en v1, exclure ses propres mentions), insère en local, émet `notification.created`. Méthodes `markAsRead`/`markAllAsRead`. Instancié dans `workspace-service.ts` comme les autres services (cf. `RadarService`).
- Nouveau query handler `packages/client/src/handlers/queries/notifications/notification-list.ts` (+ query type, + enregistrement dans les barrels `queries/index.ts` / `handlers/queries/index.ts`), sur le modèle des handlers existants réagissant aux events via `checkForChanges`.
- Nouvelle mutation `notification-mark-read` (locale, pas d'aller-retour serveur nécessaire pour la v1).
- UI : `packages/ui/src/components/notifications/notification-center.tsx` (dropdown/panel) + `notification-item.tsx`, déclenché par une icône cloche ajoutée au rail `sidebar-menu.tsx`, badge non-lu.
- Desktop : nouveau `apps/desktop/src/main/notifications.ts` modelé sur `apps/desktop/src/main/app-badge.ts` (même pattern d'écoute `eventBus`), déclenche `new Notification()` (API Electron) si la fenêtre principale n'est pas focus. Instancié dans `apps/desktop/src/main.ts` à côté de `appBadge`.

**Limitations v1 assumées** : lecture/non-lu est locale par appareil (pas de sync multi-device du statut lu) ; seules les mentions directes (pas `@everyone`) génèrent une notification.

---

## Feature 4 — Recherche dans le workspace (local-first, côté client)

**But** : recherche globale dans le workspace, exécutée entièrement en local (choix explicite de l'utilisateur), sans dépendre du pipeline IA serveur (pgvector/tsvector) qui existe mais est désactivé et conçu pour l'assistant IA, pas pour l'utilisateur.

**Constat clé** : les tables FTS5 `node_texts` et `document_texts` existent déjà côté client (migrations `00007`, `00011`) et sont **déjà alimentées en continu** à chaque création/mise à jour de node/document (`node-service.ts`, `document-service.ts`, via `extractText` du registry `packages/core`). Il ne manque qu'un handler de requête global et une UI — aucune migration nécessaire pour l'index lui-même.

**Point de vigilance vérifié dans le code** : `packages/client/src/handlers/queries/records/record-search.ts` (le handler de recherche le plus proche existant) contient une incohérence (alias `nn` déclaré mais `en.name` référencé dans le `WHERE`, table `node_names` non retrouvée ailleurs dans le schéma) — **ne pas copier ce bug**, vérifier si ce handler est du code mort avant de s'en inspirer.

**Fichiers** :
- Nouveau `packages/client/src/queries/search/workspace-search.ts` + handler `packages/client/src/handlers/queries/search/workspace-search.ts` : requêtes `MATCH` sur `node_texts` et `document_texts` (fonction `bm25()` native FTS5 pour le ranking), résultats fusionnés/triés, jointure vers `nodes`/`documents` pour la navigation. Enregistrement dans les barrels `queries/index.ts` / `handlers/queries/index.ts`.
- UI : `packages/ui/src/components/search/workspace-search-dialog.tsx`, `CommandDialog` (primitive `cmdk` déjà utilisée par le menu slash `commander.tsx`), raccourci clavier Cmd/Ctrl+K, icône de recherche ajoutée au rail `sidebar-menu.tsx`.

**Limitation v1 assumée** : la recherche ne porte que sur le contenu déjà synchronisé localement sur l'appareil — à mentionner dans l'UI plutôt que traité comme un bug.

**Point à trancher pendant l'implémentation** : tokenizer FTS5 (défaut `unicode61` actuel vs `unicode61 remove_diacritics 2`, pertinent pour du contenu en français) — non bloquant pour une v1.

---

## Ordre d'implémentation recommandé

1. **Feature 4 (recherche)** — le plus simple : aucune migration, additif, aucun risque sur l'infra de sync.
2. **Feature 1 (rail d'icônes spaces)** — additif, UI seulement, peut être fait en parallèle de la feature 4 (fichiers disjoints).
3. **Feature 3 (notifications)** — plus impliqué (nouvelle table locale, service, event wiring, UI, intégration Electron) ; bénéficie d'être fait après avoir manipulé les patterns query/event sur la feature 4.
4. **Feature 2 (PlantUML)** — à faire en dernier ou en parallèle par quelqu'un d'autre, car bloqué par une inconnue externe (choix de la librairie de rendu) à lever via un spike avant d'écrire l'intégration éditeur.

Seul point de conflit potentiel entre features : `packages/ui/src/components/layouts/sidebars/sidebar-menu.tsx` (features 3 et 4 y ajoutent chacune une icône) — à coordonner si fait en parallèle.

---

## Vérification (à faire une fois l'implémentation lancée)

- **Feature 1** : `cd apps/desktop && npm run dev` (ou web), créer plusieurs spaces, vérifier le rail d'icônes, le switch, les deep links, le responsive (mobile/desktop sidebar).
- **Feature 2** : insérer `/plantuml` dans une page, taper un diagramme valide et un diagramme invalide (vérifier l'état d'erreur), vérifier absence totale d'appel réseau (onglet Network), tester sur desktop et web.
- **Feature 3** : mentionner un autre utilisateur depuis un second compte de test, vérifier l'apparition dans le centre de notifications, le badge non-lu, le marquage lu, et la notification OS desktop quand la fenêtre n'a pas le focus.
- **Feature 4** : rechercher un mot présent dans une page/message existant, vérifier le classement des résultats et la navigation au clic ; tester avec des accents (français) pour évaluer le tokenizer par défaut.
- Lancer `npm run test` (racine ou par app) pour vérifier l'absence de régression sur les suites existantes (`apps/server`, `apps/web`).
