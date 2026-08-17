# Project Rules & Agent Guidelines

## 1. Overview & Tech Stack
- **Framework**: [NestJS 11](https://nestjs.com/) (Node.js backend)
- **Module System**: ESM (`"type": "module"` in `package.json`)
- **Language**: TypeScript
- **Database & ORM**: PostgreSQL with [Prisma ORM 7.x](https://www.prisma.io/)
- **Driver Adapter**: `@prisma/adapter-pg` (`pg` driver)
- **Package Manager**: `pnpm` (Strict requirement — do not use `npm` or `yarn`)

---

## 2. Package Management & Commands
Always use `pnpm` for running scripts and installing packages:
- **Development**: `pnpm start:dev`
- **Build**: `pnpm build`
- **Linting & Formatting**: `pnpm lint` and `pnpm format`
- **Unit Tests**: `pnpm test`
- **E2E Tests**: `pnpm test:e2e`
- **Prisma Generate**: `pnpm prisma:generate`
- **Prisma Migrate**: `pnpm prisma:migrate`
- **Prisma Seed**: `pnpm prisma:seed`
- **Prisma Studio**: `pnpm prisma:studio`

---

## 3. ESM & Import Conventions
Because this repository is configured as an ESM project (`"type": "module"`):
- **Relative Imports**: All relative imports **MUST** include the explicit `.js` extension in TypeScript files:
  ```typescript
  // Correct
  import { PrismaClient } from '../../generated/prisma/client.js';
  import { OrdersService } from './orders.service.js';

  // Incorrect
  import { PrismaClient } from '../../generated/prisma/client';
  import { OrdersService } from './orders.service';
  ```
- **External Packages**: Standard bare imports without file extensions (e.g., `@nestjs/common`, `@prisma/adapter-pg`).

---

## 4. Prisma 7 & Database Guidelines
- **Schema Location**: `prisma/schema.prisma`
- **Configuration**: Managed via `prisma.config.ts` (using `defineConfig`).
- **Prisma Client Generation**:
  - Generated output path is `../generated/prisma`.
  - Client generator uses `provider = "prisma-client"` with `importFileExtension = "js"`.
  - Always run `pnpm prisma:generate` after updating `schema.prisma`.
- **Database Connection**:
  - Prisma 7 requires driver adapters.
  - Instantiate `PrismaClient` by passing the `PrismaPg` adapter (configured with `process.env.DATABASE_URL`) via `PrismaService` (`src/utils/prisma.service.ts`).
  - Do not instantiate standalone `new PrismaClient()` directly in services or controllers — inject `PrismaService`.

---

## 5. NestJS Architecture & Design Patterns
- **Module Structure**:
  - Keep features modular within `src/<feature>/` (e.g., `orders.module.ts`, `orders.controller.ts`, `orders.service.ts`, `orders.interface.ts` or DTOs).
  - Register new modules and providers in `src/app.module.ts`.
- **Controllers**:
  - Handle routing, HTTP methods, decorators, and input parsing.
  - Delegate all business logic and data persistence to services.
- **Services**:
  - Encapsulate business rules and database queries via `PrismaService`.
  - Throw standard NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `ConflictException`, etc.) when errors occur.
- **Validation**:
  - Use `class-validator` and `class-transformer` for request DTO validation.

---

## 6. Testing & Quality Standards
- **Unit Tests**:
  - Co-locate unit tests alongside the files they test (`*.spec.ts`).
  - Mock `PrismaService` or other dependencies using `@nestjs/testing`.
  - Run tests with `pnpm test` before concluding tasks.
- **Linting**:
  - Ensure code adheres to ESLint and Prettier rules.
  - Run `pnpm lint` and fix any linting errors before finalizing changes.
- **Code Comments**:
  - Maintain documentation integrity; preserve existing comments and docstrings.
