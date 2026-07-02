# ---------- build ----------
FROM node:24-slim AS build
WORKDIR /app
# Placeholder only — `prisma generate` validates that the env var resolves but
# never connects to it. The real value is supplied at runtime via compose.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"

COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate && npm run build

# ---------- production dependencies ----------
FROM node:24-slim AS prod-deps
WORKDIR /app
# Same placeholder as the build stage — lets postinstall's `prisma generate`
# run so Prisma's engine binaries get downloaded into the image now, as root,
# instead of lazily at container startup (which would need network + write access).
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"

COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# ---------- runtime ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

RUN groupadd --system app && useradd --system --gid app app \
    && chown -R app:app /app
USER app

EXPOSE 3000

# Apply pending migrations, then start the compiled app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
