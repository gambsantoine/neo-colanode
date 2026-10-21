# Colanode – déploiement production (Docker Compose)

Stack : PostgreSQL 17 + pgvector, Valkey, serveur Colanode, web Colanode et
Caddy (reverse proxy avec HTTPS automatique Let's Encrypt).

```
Internet ──► Caddy :443 ──► WEB_DOMAIN    ──► web:80
                       └──► SERVER_DOMAIN ──► server:3000 ──► postgres / valkey
```

## Images

Les images sont construites et publiées sur GitHub Container Registry par
`.github/workflows/docker-publish.yml` :

| Image | Tags |
| --- | --- |
| `ghcr.io/gambsantoine/colanode-server` | `latest`, `X.Y.Z`, `X.Y`, `X` (tag `vX.Y.Z`) · `edge` (push sur `main`) · `sha-<commit>` |
| `ghcr.io/gambsantoine/colanode-web` | idem |

Publier une version :

```bash
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

4. Ouvrir `https://WEB_DOMAIN` et ajouter le serveur `SERVER_DOMAIN` dans l'écran
   de connexion.

## Configuration du serveur

`config.json` est monté dans le conteneur (`CONFIG=/config.json`). Les secrets y
sont référencés via `env://VAR` (fournis par `docker-compose.yaml` depuis `.env`).
Les booléens et énumérations (`enabled`, `verificationType`, …) doivent être
modifiés directement dans le JSON.

Points à revoir avant l'ouverture au public :

- **`account.verificationType`** : `automatic` (tout le monde peut s'inscrire),
  `manual` (validation par un administrateur) ou `email` (nécessite `email.enabled`).
- **Email (SMTP)** : passer `email.enabled` à `true` et renseigner le bloc
  `provider` (voir `apps/server/config.example.json`), avec les variables
  `EMAIL_SMTP_*` ajoutées à `.env` et à l'`environment` du service `server`.
- **Stockage** : par défaut sur disque dans le volume `server_storage`. Pour S3,
  remplacer `storage.provider` par le bloc `s3` de `apps/server/config.example.json`
  et ajouter les variables `S3_*`.

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
