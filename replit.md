# ToyFinancial Dealer Registration

A dealer enrollment and fulfillment portal for ToyFinancial partnership programs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/toyfinancial-registration run dev` — run the web portal
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Public and admin frontend: `artifacts/toyfinancial-registration/src/App.tsx`
- API routes: `artifacts/api-server/src/routes/toyfinancial.ts`
- Database schema: `lib/db/src/schema/index.ts`
- API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- The public portal and admin workspace share typed API hooks generated from the OpenAPI contract.
- Registration records and outbox items are stored in the built-in PostgreSQL database.
- Admin access uses an HTTP-only signed session cookie with credentials supplied through Secrets.
- Email delivery is represented in the outbox so the workflow is useful before an SMTP provider is configured.

## Product

- Retailers can request one or more ToyFinancial programs and starter materials.
- Team members can review, search, filter, update, and route dealer registrations.
- Team members can manage province/product document links and review queued acknowledgement emails.

## User preferences

No project-specific preferences recorded.

## Gotchas

- Add production secrets before using the admin workspace; the development password fallback is not suitable for deployment.
- Starter-pack links are admin-managed and may be empty until the team adds approved resources.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
