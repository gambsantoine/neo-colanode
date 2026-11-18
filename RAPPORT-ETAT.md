# Neo Colanode : état des lieux et reste à faire

> Rapport du 21/10/2026, établi d'après le code de `main` (`cb4cdcc7`). Il compare ce qui a été implémenté depuis le fork (base upstream `d6495236`) avec le plan annoncé dans [`AMELIORATIONS.md`](AMELIORATIONS.md).

## Synthèse

| # | Fonctionnalité annoncée | Statut | Avancement |
| --- | --- | --- | --- |
| 1 | Rail d'icônes façon Discord pour les espaces | ✅ Fait (partiel sur les détails) | ~85 % |
| 2 | Bloc éditeur `/plantuml` en rendu local | ✅ Fait, au-delà du plan | 100 % |
| 3 | Notifications (centre in-app + desktop) | ⏳ Non commencé | 0 % |
| 4 | Recherche globale dans le workspace | ⏳ Non commencé | 0 % |

Sur les 4 fonctionnalités annoncées, **2 sont livrées** et **2 restent à faire**. Six fonctionnalités **non annoncées** ont en plus été livrées : API publique, clés API, serveur MCP, catégories, glisser-déposer dans la barre latérale et export PDF.

Le plan recommandait l'ordre 4 → 1 → 3 → 2. L'ordre suivi a été 1 → 2, et les deux fonctionnalités jugées les plus simples ou les plus utiles (recherche, notifications) restent à faire.

---

## 1. Fonctionnalités annoncées

### Feature 1 : rail d'icônes des espaces ✅

**Ce qui existe**

- `packages/ui/src/components/layouts/sidebars/sidebar-space-icon.tsx` : une icône (avatar) par espace avec tooltip et indicateur d'espace actif.
- `sidebar-menu.tsx` : le rail affiche les espaces, le chat, les outils et les paramètres ; bouton de création d'espace intégré.
- `sidebar.tsx` : l'espace actif est mémorisé (`sidebar.activeSpaceId`), au-delà du simple `useState` prévu.
- Les espaces se réordonnent par glisser-déposer (`use-sidebar-drag-drop.tsx`, `sidebar-drop-indicator.tsx`).
- `SpaceSidebarItem` a été refondu en `space-sidebar-children.tsx` et `space-sidebar-draggable-item.tsx`.

**Reste à faire**

- [ ] **Badge non-lu par espace** dans le rail (prévu via `radar.getNodeState`) : seul le chat a un badge aujourd'hui.
- [ ] **Deep links** : quand on ouvre l'URL d'un nœud, le rail ne bascule pas sur l'espace correspondant (le point était déjà ouvert dans le plan).
- [ ] Vérifier le rendu sur mobile (`sidebar-mobile.tsx`).

### Feature 2 : bloc `/plantuml` ✅

**Ce qui existe**

- Extension TipTap, vue, commande slash et renderer : `packages/ui/src/editor/{extensions,views,commands,renderers}/plantuml.tsx`.
- Moteur `packages/ui/src/lib/plantuml.ts` : `@plantuml/core` + Graphviz WASM, **chargé à la demande** (~5 Mo hors du bundle initial), **sans appel réseau**, avec un cache de 50 rendus et thème clair/sombre.
- Aperçu avec debounce (400 ms) et erreurs affichées dans le bloc (`components/plantuml/plantuml-preview.tsx`).
- **En plus du plan** : un outil PlantUML autonome (`components/tools/plantuml/`, route `tools/plantuml`, menu *Outils*) et la prise en compte des diagrammes dans l'export PDF.

Le risque principal du plan (trouver une librairie 100 % locale) est levé.

**Reste à faire / limites**

- [ ] Les `!include <C4/...>` (stdlib, sprites) ne fonctionnent pas hors ligne : le documenter dans l'interface ou embarquer les bibliothèques courantes.
- [ ] La CSP desktop autorise déjà `wasm-unsafe-eval` (`apps/desktop/index.html`) : reste à valider le rendu sur un build packagé.
- [ ] Aucun test automatisé sur le rendu ou la sérialisation du bloc.

### Feature 3 : notifications ⏳

**Rien n'a été implémenté.** Pas de table `notifications`, pas de `notification-service.ts` (absent de `packages/client/src/services/workspaces/`), pas d'icône cloche dans le rail, pas de `apps/desktop/src/main/notifications.ts`.

**Reste à faire** (repris du plan, toujours valable : les briques `node_references` et l'event `node.reference.created` existent)

- [ ] Migration client `notifications` + typings Kysely + nouvel `IdType` dans `packages/core`.
- [ ] `notification-service.ts` branché sur `node.reference.created`, instancié dans `workspace-service.ts`.
- [ ] Query `notification-list` et mutation locale `notification-mark-read`.
- [ ] UI : `notification-center.tsx`, `notification-item.tsx`, icône cloche avec badge dans `sidebar-menu.tsx`.
- [ ] Notifications OS dans Electron (modèle : `app-badge.ts`).

### Feature 4 : recherche globale ⏳

**Rien n'a été implémenté.** Les index FTS5 `node_texts` et `document_texts` existent et sont toujours alimentés par `node-service.ts` et `document-service.ts`, mais aucune requête ni interface ne les exploite.

**Reste à faire**

- [ ] Query `workspace-search` + handler (`MATCH` sur `node_texts` et `document_texts`, tri `bm25()`), enregistrés dans les barrels.
- [ ] `workspace-search-dialog.tsx` (`CommandDialog`/cmdk), raccourci Ctrl/Cmd+K, icône dans le rail.
- [ ] Choisir le tokenizer FTS5 (`unicode61 remove_diacritics 2` conseillé pour le français ; cela demande une migration qui reconstruit l'index).
- [ ] **Bug toujours présent** dans `packages/client/src/handlers/queries/records/record-search.ts` (l. 94-97) : l'alias `nn` (`node_names`) est déclaré mais `en.name` est utilisé dans le `WHERE`. À corriger ou supprimer avant de s'en inspirer.

---

## 2. Fonctionnalités livrées hors plan

| Fonctionnalité | Emplacement principal | Tests |
| --- | --- | --- |
| **API publique REST** (`/api`) : `/me`, workspaces, espaces, nœuds (CRUD), documents (lecture/écriture/suppression), pagination, versioning, erreurs typées | `packages/api/`, `apps/server/src/lib/api-*.ts` | `apps/server/test/api/public-api.test.ts`, `packages/api/test/pagination.test.ts` |
| **Clés API** (compte et workspace) : création, liste, révocation, UI dédiée | `apps/server/src/api/client/routes/{accounts,workspaces}/api-keys/`, migration `00033-create-api-keys-table.ts`, `components/accounts/api-key-*.tsx` | via les tests de l'API publique |
| **Serveur MCP** : `list_workspaces`, `list_spaces`, `list_nodes`, `read_document`, `create_page`, `write_document`, `rename_node`, conversion Markdown ⇄ document | `apps/mcp/` | `apps/mcp/test/markdown.test.ts` |
| **Catégories** : nouveau type de nœud `category` (enfant d'un espace), création, dropdown, glisser-déposer | `packages/core/src/registry/nodes/category.ts`, `components/categories/` | aucun |
| **Glisser-déposer** dans la barre latérale (espaces, éléments, catégories) et sélection de dossier à la création | `hooks/use-sidebar-drag-drop.tsx`, `components/folders/folder-select.tsx`, `mutations/spaces/space-child-reorder.ts` | aucun |
| **Export PDF / impression** : PDF A4 via `printToPDF` sur desktop, iframe isolée avec CSP sur le web | `packages/ui/src/lib/export.ts`, `components/documents/document-actions-bar.tsx`, `apps/desktop/src/main.ts`, `apps/web/src/main.tsx` | aucun |

---

## 3. Dette et points d'attention

- **Image Docker** 🚧 : le service `server` de `hosting/docker/docker-compose.yaml` est commenté et pointe vers l'image upstream `ghcr.io/colanode/server`, qui ne contient pas les ajouts du fork. Travail en cours, pas encore commité : workflow `.github/workflows/docker-publish.yml` (images server + web sur ghcr.io, tags `edge`/semver), qui remplace les 4 workflows upstream, et dossier `hosting/production/` (Compose, Caddy, config). Reste à le commiter, à valider une première publication et à mettre à jour le README.
- **Branding** : le README et la couverture sont passés en bleu, mais les icônes des applications (`colanode-logo.ico/.icns/.png`, favicon web, manifest) sont toujours vertes, et le nom affiché dans les apps reste « Colanode ».
- **Tests UI** : aucune des fonctionnalités UI du fork (rail, catégories, glisser-déposer, PlantUML, export) n'a de test dans `apps/web/test`.
- **Synchronisation upstream** : le fork part de `d6495236`. Prévoir un rebase/merge régulier depuis `colanode/colanode`, surtout sur les fichiers modifiés de la barre latérale, qui risquent des conflits.
- **Migration serveur `00033`** : vérifier qu'elle ne collisionne pas avec une future migration upstream du même numéro.
- **Documentation API** : pas de spécification OpenAPI ni de doc des endpoints `/api` pour les intégrateurs.

---

## 4. Reste à faire, par priorité

1. **Recherche globale** (feature 4) : la plus simple (aucune migration pour l'index) et la plus utile au quotidien.
2. **Notifications** (feature 3).
3. **Finitions du rail** : badge non-lu par espace, deep links.
4. **Finaliser les images Docker** (en cours) et rebranding des icônes d'application.
5. **Tests** sur les fonctionnalités UI du fork et doc OpenAPI de l'API publique.
