# Local Database

This app uses a local PostgreSQL database for development and local operation.
The database is provided by `docker-compose.yml` and is bound to `127.0.0.1`
only.

## Start

```bash
cp .env.example .env
npm run db:up
npm run prisma:validate
npm run db:migrate
npm run seed
```

If a migration is not available for a local development change, use:

```bash
npm run db:push
```

## Stop

```bash
npm run db:down
```

## Reset

This removes the Docker volume and all local data.

```bash
npm run db:reset
npm run db:migrate
npm run seed
```

## Connection

The default local connection string matches `.env.example`:

```env
DATABASE_URL="postgresql://paperclip:paperclip@127.0.0.1:55432/paperclip"
DIRECT_URL="postgresql://paperclip:paperclip@127.0.0.1:55432/paperclip"
```
