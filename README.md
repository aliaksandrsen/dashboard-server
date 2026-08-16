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

Start PostgreSQL and pgAdmin containers:

```bash
docker compose up -d
```

- **PostgreSQL**: `localhost:5432` (`postgres:postgres`, db: `dashboard`)
- **pgAdmin**: [http://localhost:5050](http://localhost:5050) (`admin@admin.com` / `admin`)

### 3. Install & Database Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma Client & apply migrations
pnpm prisma:generate
pnpm prisma:migrate

# (Optional) Seed database with test data
pnpm prisma:seed
```

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
pnpm prisma:migrate  # Apply migrations
pnpm prisma:seed     # Seed fake data
```

### Testing & Code Quality

```bash
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests
pnpm test:cov      # Coverage report
pnpm lint          # Run linter
```
