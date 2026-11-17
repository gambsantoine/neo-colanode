<div align="center">
<img alt="Neo Colanode" src="assets/images/neo-colanode-github-cover.jpg">
<p></p>
<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue" style="height: 22px;" />
</a>
<a target="_blank" href="https://github.com/colanode/colanode" style="background:none">
    <img alt="" src="https://img.shields.io/badge/Fork_de-colanode%2Fcolanode-1d4ed8" style="height: 22px;" />
</a>
</div>

# Neo Colanode

### Fork de [Colanode](https://github.com/colanode/colanode) : espace de collaboration open-source, local-first et auto-hébergeable

**Neo Colanode** est un fork de [Colanode](https://github.com/colanode/colanode). Il reprend sa base (chat temps réel, pages riches, bases de données, fichiers, synchronisation local-first via CRDT/Yjs) et y ajoute une API publique, un serveur MCP, une organisation des espaces façon Discord, des diagrammes PlantUML et l'export PDF.

> Neo Colanode n'est pas affilié à l'équipe Colanode. Les services hébergés (app.colanode.com, Colanode Cloud EU/US) et l'image Docker `ghcr.io/colanode/server` appartiennent au projet d'origine et **ne contiennent pas** les fonctionnalités de ce fork.

### Fonctionnalités héritées de Colanode

- **Chat temps réel** : messagerie instantanée pour les équipes et les individus.
- **Pages en texte riche** : documents, wikis et notes dans un éditeur proche de Notion.
- **Bases de données personnalisables** : champs, vues (table, kanban, calendrier).
- **Gestion de fichiers** : stockage et partage dans des workspaces sécurisés.
- **Local-first** : tout est écrit dans une base SQLite locale puis synchronisé en arrière-plan ; l'application fonctionne hors ligne.

### Ce qu'ajoute Neo Colanode

- **Rail d'espaces façon Discord** : chaque espace est une icône permanente dans la barre latérale, réordonnable par glisser-déposer ; l'espace actif est mémorisé.
- **Catégories** : nouveau type de nœud `category` pour regrouper pages, canaux, bases et dossiers à l'intérieur d'un espace, avec glisser-déposer entre catégories.
- **Diagrammes PlantUML** : commande `/plantuml` dans l'éditeur et outil PlantUML dédié (menu *Outils*). Le rendu est fait **100 % en local** (`@plantuml/core` + Graphviz WASM), sans appel réseau.
- **draw.io local** : éditeur draw.io embarqué dans l'application (menu *Outils*), sans `embed.diagrams.net` ni autre service externe. Il est téléchargé une seule fois au build avec `npm run fetch:drawio -w @colanode/scripts` (version et empreinte figées dans `scripts/src/drawio/index.ts`).
- **Titre et catégories des pages** : titre modifiable en haut de la page et catégories (`#tag`) propres au workspace, utilisables dans la recherche (Ctrl/Cmd+K) : `#infra sauvegarde`.
- **Volet d'informations des pages** : un bouton ouvre à droite les tags, l'emplacement, l'auteur, les dates, le nombre de mots, le temps de lecture et les sous-pages ; les dates de création et de modification s'affichent sous le titre.
- **Wikis publiables** : type d'espace dédié à la documentation (pages, catégories, dossiers, bases, sans canaux), publiable par **lien d'accès secret** ou à une **adresse publique lisible** (`/wiki/doc-produit/guides/premiers-pas`). Le serveur rend les pages en HTML façon documentation technique : navigation, sommaire, recherche, images, bases en lecture seule, diagrammes PlantUML ; les anciennes adresses redirigent après un renommage.
- **Pseudo** : choisi à l'inscription (généré pour les comptes existants), il remplace le vrai nom sur les pages publiques.
- **Export PDF / impression** : export d'une page en PDF (A4) sur desktop, impression via une iframe isolée sur le web ; les diagrammes PlantUML sont inclus.
- **API publique REST** (`/api`) : workspaces, espaces, nœuds et documents, avec pagination et versioning, authentifiée par **clé API** (`Authorization: Bearer …`).
- **Clés API** : création, liste et révocation au niveau du compte ou du workspace, depuis l'interface.
- **Serveur MCP** (`apps/mcp`) : permet à un assistant IA (Claude, etc.) de lister les workspaces/espaces/wikis/nœuds, lire un document, créer une page, écrire du Markdown dans un document, renommer un nœud et connaître l'adresse d'un wiki publié.

![Aperçu de Colanode](assets/images/colanode-desktop-preview.gif)

## Dernières mises à jour

| Date | Changement |
| --- | --- |
| 17/11/2026 | Wikis publiables (lien d'accès ou adresse publique), pseudo des comptes, volet d'informations des pages, wikis dans l'API et le serveur MCP 1.1.0 |
| 19/10/2026 | Bloc `/plantuml` dans l'éditeur, outil PlantUML, rendu local ; export PDF incluant les diagrammes |
| 19/10/2026 | Serveur MCP : écriture de documents en Markdown, impression/export PDF |
| 28/09/2026 | Correctifs sur l'API et le réordonnancement de la barre latérale |
| 25/09/2026 | Type de nœud `category`, nouveaux comportements de la barre latérale (glisser-déposer) |
| 25/09/2026 | Package `@colanode/api` (API publique) et première version du serveur MCP |
| 24/09/2026 | Clés API (compte et workspace), routes API, refonte visuelle de la barre latérale (rail d'espaces) |

## Roadmap

> Légende : ✅ fait · 🚧 en cours · ⏳ à faire

| Statut | Fonctionnalité | Notes |
| --- | --- | --- |
| ✅ | Rail d'espaces façon Discord | |
| ✅ | Catégories dans les espaces | |
| ✅ | Bloc et outil PlantUML (rendu local) | |
| ✅ | Export PDF / impression | |
| ✅ | API publique + clés API | |
| ✅ | Serveur MCP | |
| ✅ | Wikis publiables (lien d'accès, adresse publique) | Migrations serveur 00034 et 00035 |
| ✅ | Pseudo des comptes et volet d'informations des pages | |
| ⏳ | Recherche globale dans le workspace (Ctrl/Cmd+K, index FTS5 local) | |
| ⏳ | Centre de notifications (mentions) + notifications desktop | |
| ⏳ | Badge non-lu par espace dans le rail | |
| 🚧 | Images Docker Neo Colanode (server + web sur ghcr.io) et déploiement de production | `.github/workflows/docker-publish.yml`, `hosting/production/` |
| ⏳ | | |
| ⏳ | | |

## Comment ça marche

Neo Colanode comprend une application cliente (web ou desktop) et un serveur auto-hébergé. Une même application peut se connecter à plusieurs serveurs, chacun contenant un ou plusieurs **workspaces**.

### Fonctionnement local-first

Toutes les modifications sont d'abord enregistrées dans une base SQLite locale puis synchronisées avec le serveur par un processus en arrière-plan : vous pouvez continuer à travailler même si votre ordinateur ou le serveur est hors ligne. Les lectures sont aussi locales, donc immédiates.

### Éditions concurrentes

Neo Colanode s'appuie, comme Colanode, sur des **CRDT** (Conflict-free Replicated Data Types) via [Yjs](https://docs.yjs.dev/) pour la collaboration temps réel sur les pages et les enregistrements de bases de données. Les messages et les fichiers n'acceptent pas d'éditions concurrentes et utilisent des tables plus simples.

## Auto-hébergement

> Les images Docker Neo Colanode (`ghcr.io/<owner>/colanode-server` et `colanode-web`) et la configuration de production (`hosting/production/`) sont en cours de mise en place. En attendant, pour profiter des fonctionnalités du fork, lancez le serveur depuis les sources (voir [Lancer en local](#lancer-en-local)). Dans `hosting/docker/docker-compose.yaml`, le service `server` (image upstream) est commenté : seules les dépendances (Postgres, Redis, serveur mail, MinIO en option) sont démarrées.

Le dossier [`hosting/`](hosting/) contient le fichier Docker Compose et les configurations de déploiement ; pour Kubernetes, voir [`hosting/kubernetes/`](hosting/kubernetes/) (charts Helm et documentation). Prérequis :

- **Postgres** avec l'extension **pgvector** ;
- **Redis** (ou tout service compatible, ex. Valkey) ;
- un **stockage** pour les fichiers : système de fichiers local par défaut, ou **S3-compatible**, **Google Cloud Storage**, **Azure Blob Storage** ;
- le **serveur API** (`apps/server`).

#### Configuration

- Le fichier `config.json` est la source de vérité. Utilisez `env://NOM_VAR` pour lire une valeur sensible depuis l'environnement, ou `file://chemin/secret.pem` pour inclure le contenu d'un fichier monté (ajoutez `?` pour les rendre optionnels). Seuls `POSTGRES_URL` et `REDIS_URL` sont requis.
- Pour personnaliser :
  1. copiez `apps/server/config.json`, modifiez-le et montez-le dans le conteneur (voir `hosting/docker/docker-compose.yaml`) ;
  2. avec Helm, activez `colanode.configFile.enabled` et passez le fichier via `--set-file colanode.configFile.data=./config.json` (détails dans [`hosting/kubernetes/README.md`](hosting/kubernetes/README.md)) ;
  3. gardez les secrets en variables d'environnement, résolues à l'exécution via `env://`.

Les variables d'environnement ne surchargent pas les champs de configuration classiques : seules les valeurs marquées `env://` sont lues depuis l'environnement.

#### Wikis publics

Les wikis publiés sont servis par le serveur API, sous `/wiki/…` (et `/s/…` pour les liens d'accès) : aucune règle de proxy supplémentaire n'est nécessaire. En production, renseignez `publicUrl` dans `config.json` (ex. `"publicUrl": "https://api.exemple.fr"`) : l'adresse canonique, le sitemap et les liens d'accès ne dépendent alors plus de l'en-tête `Host` de la requête.

### Lancer en local

1. Cloner le dépôt :

   ```bash
   git clone https://github.com/gambsantoine/colanode.git
   cd colanode
   ```

2. Installer les dépendances à la racine :

   ```bash
   npm install
   ```

3. Démarrer les dépendances (Postgres, Redis, serveur mail) depuis la racine, avec stockage fichiers par défaut :

   ```bash
   docker compose -f hosting/docker/docker-compose.yaml up -d
   # ou, avec MinIO pour un stockage S3 :
   docker compose -f hosting/docker/docker-compose.yaml --profile s3 up -d
   ```

4. Lancer les applications voulues :

   **Serveur**

   ```bash
   cd apps/server
   cp .env.example .env   # à adapter
   npm run dev
   ```

   **Web**

   ```bash
   cd apps/web
   npm run dev
   ```

   **Desktop**

   ```bash
   cd apps/desktop
   npm run dev
   ```

### Serveur MCP

Le serveur s'installe sans cloner le repo : seul Node.js 20 ou plus est nécessaire. Créez une clé API dans l'application (paramètres du compte ou du workspace), puis ajoutez le serveur à votre client MCP.

**Claude Code :**

```bash
claude mcp add colanode \
  -e COLANODE_URL=http://localhost:3000 \
  -e COLANODE_API_KEY=<votre clé API> \
  -- npx -y https://github.com/gambsantoine/neo-colanode/releases/download/mcp-v1.0.1/colanode-mcp-1.0.1.tgz
```

**Autres clients MCP** (Claude Desktop, Cursor, etc.) :

```json
{
  "mcpServers": {
    "colanode": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/gambsantoine/neo-colanode/releases/download/mcp-v1.0.1/colanode-mcp-1.0.1.tgz"
      ],
      "env": {
        "COLANODE_URL": "http://localhost:3000",
        "COLANODE_API_KEY": "<votre clé API>"
      }
    }
  }
}
```

La version 1.1.0 (wikis, outil `get_wiki_publication`) sera téléchargeable une fois le tag `mcp-v1.1.0` poussé ; remplacez alors `1.0.1` par `1.1.0` dans les commandes ci-dessus.

Pour publier une nouvelle version, changez `version` dans `apps/mcp/package.json`, puis poussez un tag `mcp-vX.Y.Z` : le workflow `mcp-release.yml` construit le paquet et crée la release GitHub.

## Tests

Les tests utilisent Vitest. Lancez `npm run test` dans le dossier concerné :

| Dossier | Remarque |
| --- | --- |
| `apps/server` | Testcontainers (Postgres, Redis) : Docker doit tourner. Voir [`apps/server/README.md`](apps/server/README.md). Sans Docker : `npm run test:unit` (tests unitaires, base et Redis simulés). |
| `apps/web` | |
| `packages/api` | |
| `apps/mcp` | Conversion Markdown ⇄ document |

`npm run test` à la racine lance les suites via Turbo.

## Crédits & licence

Neo Colanode est un fork de [Colanode](https://github.com/colanode/colanode), créé par l'équipe Colanode. Merci à eux pour le projet d'origine.

Neo Colanode, comme Colanode, est distribué sous [licence Apache 2.0](LICENSE).
