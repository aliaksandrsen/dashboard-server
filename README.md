# Dashboard Server

Backend API built with [NestJS](https://nestjs.com/) and [Prisma ORM](https://www.prisma.io/).

---

## 🚀 Getting Started

### 1. Environment Variables

Create `.env` in the root directory:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dashboard?schema=public"
```

### 2. Start Database (Docker)

Start PostgreSQL container:

```bash
docker compose up -d
```

- **PostgreSQL**: `localhost:5432` (`postgres:postgres`, db: `dashboard`)

### 3. Install & Database Setup

```bash
# Install dependencies
pnpm install

# Apply existing migrations (creates the database schema)
pnpm prisma:migrate

# Generate Prisma Client
pnpm prisma:generate

# (Optional) Seed database with test data
pnpm prisma:seed
```

---

## 🗄️ Database Migrations

`prisma/schema.prisma` is the single source of truth for the database schema. Prisma generates SQL migration files from it and stores them in `prisma/migrations/`. These files must be committed to git — they are how the database schema is recreated on other machines.

### Changing the Schema (Development)

1. Edit `prisma/schema.prisma` (add or change models, fields, relations, etc.).
2. Make sure PostgreSQL is running:
   ```bash
   docker compose up -d
   ```
3. Create and apply a migration:
   ```bash
   pnpm prisma:migrate --name add_order_status
   ```
   Use a short `snake_case` name describing the change. Without `--name`, Prisma asks for one interactively.

   `pnpm prisma:migrate` runs `prisma migrate dev`, which:
   - compares `schema.prisma` with the migration history (using a temporary shadow database),
   - generates `prisma/migrations/<timestamp>_<name>/migration.sql`,
   - applies all pending migrations to the development database,
   - records applied migrations in the `_prisma_migrations` table.

4. Regenerate the Prisma Client:
   ```bash
   pnpm prisma:generate
   ```

> **Note:** Prisma 7 no longer runs `prisma generate` (or the seed script) automatically after `migrate dev`, so step 4 is required whenever the schema changes. Restart `pnpm start:dev` if it is already running.

If Prisma detects schema drift or a change that can drop data, it will warn you and may offer to reset the development database — this deletes all local data.

### When to Run Migrations

| Situation | Commands |
| --- | --- |
| First setup / fresh clone | `pnpm prisma:migrate` → `pnpm prisma:generate` |
| You edited `schema.prisma` | `pnpm prisma:migrate --name <change_name>` → `pnpm prisma:generate` |
| You pulled new migration files | `pnpm prisma:migrate` → `pnpm prisma:generate` |
| Production / CI | `pnpm prisma:generate` before `pnpm build`, then `pnpm exec prisma migrate deploy` before starting the app |

`/generated/prisma` is ignored by git, so the client does not exist on a fresh clone and becomes stale after any schema change. That is why `pnpm prisma:generate` is needed in every development case above, not only when you edit the schema yourself.

### Production / CI

`prisma migrate deploy` only applies migrations that are already committed to `prisma/migrations/`. It does not create new migrations, does not prompt, and does not reset the database.

Generate the client at build time and apply migrations before starting the new app version:

```bash
pnpm install
pnpm prisma:generate
pnpm build
pnpm exec prisma migrate deploy
pnpm start:prod
```

Rules of thumb:

- Never edit a migration that has already been applied or pushed — create a new migration instead.
- `migrate dev` (`pnpm prisma:migrate`) is for development only.
- `migrate deploy` is the production/CI command: it does not use a shadow database and never changes migration files.
- Migration files are timestamped (`prisma/migrations/20260816170508_initialize_dashboard_db/`), so migrations are always applied in a deterministic order.

---

## 🏃 Running the App

```bash
# Development (watch mode)
pnpm start:dev

# Production build & run
pnpm build
pnpm start:prod
```

---

## 🛠 Useful Scripts

### Database & Prisma

```bash
pnpm prisma:studio   # Open Prisma Studio (GUI database viewer)
pnpm prisma:migrate  # Create & apply migrations (development)
pnpm prisma:generate # Regenerate Prisma Client after schema changes
pnpm prisma:seed     # Seed fake data
```

### Testing & Code Quality

```bash
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests
pnpm test:cov      # Coverage report
pnpm lint          # Run linter
```
