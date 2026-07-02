# NestJS Template

Modular NestJS backend template with:

- **PostgreSQL + Prisma 7** (driver adapter, generated client in `src/generated`)
- **JWT authentication** — register/login, access + refresh token rotation, logout
- **Role-based access control** — `@Roles(Role.ADMIN)` on any route
- **Swagger/OpenAPI** docs at `/docs` (non-production only)
- **Config with env validation** (Joi), global validation pipe, exception filter, request logging
- **Jest** unit tests + full e2e suite (runs without a database)
- **Docker** — multi-stage Dockerfile + docker-compose with Postgres

## Project structure

```
prisma/
  schema.prisma          # data model (datasource url lives in prisma.config.ts)
  seed.ts                # seeds an admin user
prisma.config.ts         # Prisma 7 CLI config (migrations, seed, datasource)
src/
  main.ts                # bootstrap
  app.setup.ts           # global pipes/prefix/versioning (shared with e2e tests)
  swagger.ts             # OpenAPI setup
  app.module.ts          # root module, global guards/filter/interceptor
  config/                # env config + Joi validation
  common/
    decorators/          # @Public(), @Roles(), @CurrentUser()
    filters/             # consistent error responses
    interceptors/        # request logging
  prisma/                # global PrismaModule/PrismaService (pg driver adapter)
  generated/             # Prisma client output (gitignored, regenerated on install)
  modules/
    health/              # public health check (includes DB ping)
    auth/                # JWT auth: controller, service, strategies, guards, DTOs
    users/               # sample CRUD module with role-restricted routes
test/                    # e2e tests with an in-memory Prisma mock
```

## Getting started

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env     # then edit secrets

# 3. Start Postgres (or point DATABASE_URL at an existing instance)
docker compose up -d db

# 4. Create the schema and seed the admin user
npm run db:migrate       # creates/applies migrations
npm run db:seed          # admin@example.com / Admin123!

# 5. Run
npm run start:dev
```

- API base: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`

## API overview

| Method | Path                | Auth          | Description                        |
| ------ | ------------------- | ------------- | ---------------------------------- |
| GET    | `/api/v1/health`    | public        | Liveness + DB check                |
| POST   | `/api/v1/auth/register` | public    | Create account, returns tokens     |
| POST   | `/api/v1/auth/login`    | public    | Login, returns tokens              |
| POST   | `/api/v1/auth/refresh`  | refresh token | Rotate the token pair          |
| POST   | `/api/v1/auth/logout`   | bearer    | Invalidate stored refresh token    |
| GET    | `/api/v1/users/me`      | bearer    | Current user profile               |
| PATCH  | `/api/v1/users/me`      | bearer    | Update own profile                 |
| GET    | `/api/v1/users`         | admin     | List users                         |
| GET    | `/api/v1/users/:id`     | admin     | Get user by id                     |

Every route requires a valid access token by default (global guard); opt out with `@Public()`.
Restrict routes with `@Roles(Role.ADMIN)`.

## Scripts

| Script                 | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm run start:dev`    | Dev server with watch mode                |
| `npm run build`        | Compile to `dist/`                        |
| `npm test`             | Unit tests                                |
| `npm run test:e2e`     | E2E tests (no database needed)            |
| `npm run lint`         | ESLint with autofix                       |
| `npm run db:migrate`   | Create/apply migrations (dev)             |
| `npm run db:deploy`    | Apply migrations (production)             |
| `npm run db:seed`      | Seed admin user                           |
| `npm run db:studio`    | Prisma Studio                             |

## Docker

```bash
docker compose up --build
```

Builds the app image (multi-stage, non-root user), starts Postgres, waits for it to be
healthy, applies migrations on boot, and serves on port 3000.

## Adding a new module

1. `src/modules/<name>/` with `<name>.module.ts`, controller, service, `dto/`.
2. Add the model to `prisma/schema.prisma`, then `npm run db:migrate`.
3. Import the module in `app.module.ts`.
4. Routes are protected by default — add `@Public()` or `@Roles()` as needed.

## Environment variables

See [.env.example](.env.example). Validation lives in
[src/config/env.validation.ts](src/config/env.validation.ts) — the app refuses to boot
if a required variable is missing or malformed.
