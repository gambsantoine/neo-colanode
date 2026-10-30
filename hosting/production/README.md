# Colanode – déploiement production (Docker Compose)

Stack : PostgreSQL 17 + pgvector, Valkey, serveur Colanode, web Colanode et
Caddy (reverse proxy avec HTTPS automatique Let's Encrypt).

```
Internet ──► Caddy :443 ──► WEB_DOMAIN    ──► web:80
                       └──► SERVER_DOMAIN ──► server:3000 ──► postgres / valkey
```

## Images

Les images sont construites et publiées sur GitHub Container Registry par
`.github/workflows/docker-publish.yml`, **uniquement lors de la création d'un tag
`vX.Y.Z`** :

| Image | Tags |
| --- | --- |
| `ghcr.io/gambsantoine/colanode-server` | `X.Y.Z`, `X.Y`, `X`, `latest`, `sha-<commit>` |
| `ghcr.io/gambsantoine/colanode-web` | idem |

Publier une version (depuis `main`) :

```bash
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

> Au premier push, les packages GHCR sont **privés**. Pour les tirer sans
> authentification : GitHub → Packages → `colanode-server` / `colanode-web` →
> Package settings → Change visibility → Public. Sinon, sur le serveur :
> `echo <PAT read:packages> | docker login ghcr.io -u gambsantoine --password-stdin`.

## Installation

1. Créer deux enregistrements DNS vers la machine : `WEB_DOMAIN` et `SERVER_DOMAIN`
   (ports 80 et 443 ouverts).
2. Configurer l'environnement :

   ```bash
   cd hosting/production
   cp .env.example .env
   # générer les mots de passe
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
   sed -i "s/^VALKEY_PASSWORD=.*/VALKEY_PASSWORD=$(openssl rand -hex 32)/" .env
   # puis éditer WEB_DOMAIN, SERVER_DOMAIN, ACME_EMAIL, COLANODE_VERSION
   ```

3. Démarrer :

   ```bash
   docker compose up -d
   docker compose logs -f server
   ```

4. Ouvrir `https://WEB_DOMAIN` : le serveur `SERVER_DOMAIN` est pré-enregistré
   automatiquement (variable `COLANODE_SERVER_URL` du service `web`, plusieurs URL
   possibles séparées par des virgules).

## Configuration du serveur

`config.json` est monté dans le conteneur (`CONFIG=/config.json`). Les secrets y
sont référencés via `env://VAR` (fournis par `docker-compose.yaml` depuis `.env`).
Les booléens et énumérations (`enabled`, `verificationType`, …) doivent être
modifiés directement dans le JSON.

Points à revoir avant l'ouverture au public :

- **`account.verificationType`** : `automatic` (tout le monde peut s'inscrire),
  `manual` (sur invitation uniquement) ou `email` (nécessite `email.enabled`).
  En mode `manual`, seul le premier compte de l'instance peut s'inscrire librement :
  créez-le avant d'ouvrir le serveur au public. Les suivants sont invités par un
  owner ou admin de workspace. Avec `email.enabled`, l'invité active son compte par
  « Mot de passe oublié », ce qui prouve qu'il possède l'adresse. Sans e-mail,
  quiconque connaît l'adresse invitée peut s'inscrire à sa place.
- **Email (SMTP)** : passer `email.enabled` à `true` et renseigner le bloc
  `provider` (voir `apps/server/config.example.json`), avec les variables
  `EMAIL_SMTP_*` ajoutées à `.env` et à l'`environment` du service `server`.
- **Stockage** : par défaut sur disque dans le volume `server_storage`. Pour S3,
  remplacer `storage.provider` par le bloc `s3` de `apps/server/config.example.json`
  et ajouter les variables `S3_*`. Pour un autre dossier que `/var/lib/colanode/storage`,
  ajouter `COLANODE_STORAGE_DIR` à l'`environment` du service `server` : le conteneur
  tourne sous l'utilisateur `node` et lui attribue ce dossier au démarrage.
- **Proxy** : `trustProxy` liste les adresses des proxys devant le serveur, séparées
  par des virgules. La valeur par défaut couvre les réseaux privés, dont celui de
  Docker. Si elle ne correspond pas à votre proxy, l'IP des clients et donc les
  limites de débit seront faussées. Derrière Cloudflare, définir `clientIpHeader` à
  `cf-connecting-ip`, uniquement si le serveur n'est joignable que par Cloudflare.
- **draw.io** : l'outil charge l'éditeur depuis `https://embed.diagrams.net`, donc il
  demande un accès à ce site. Pour l'auto-héberger, lancer l'image `jgraph/drawio`,
  définir `VITE_DRAWIO_URL` au build de l'image web et ajouter son origine au
  `frame-src` de `apps/web/Dockerfile`.

## Exploitation

```bash
# Mise à jour
docker compose pull && docker compose up -d

# Sauvegarde PostgreSQL
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > colanode-$(date +%F).sql.gz

# Sauvegarde des fichiers
docker run --rm -v colanode_server_storage:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```
