# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # prisma generate + next build
npm run lint         # ESLint

npm run db:seed      # Seed the database (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio (database GUI)
npm run migrate:deploy  # Deploy pending migrations to production DB
```

## Environment Variables

Two variables are required:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_PASSWORD` — Secret for iron-session cookie encryption (min 32 chars)

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Prisma (PostgreSQL), and iron-session for auth.

### Route Structure

| Route | Description |
|-------|-------------|
| `/pos` | Cashier POS terminal (main selling interface) |
| `/admin/*` | Admin panel (inventory, dishes, products, reports, sales history) |
| `/(auth)/login` | Login page |
| `/receipt/[id]` | Printable receipt |

Root `/` redirects to `/pos`. Middleware at `middleware.ts` enforces auth and role-based access: `CASHIER` role is blocked from `/admin/*` routes.

### Two User Roles

- `ADMIN` — full access including `/admin/*`
- `CASHIER` — POS only (`/pos`)

### UI Target Devices

- **`/pos`** — designed for **mobile** (used by the cashier on a phone/tablet). Keep layouts vertical, touch-friendly, and avoid desktop-only patterns.
- **`/admin/*`** — designed for **desktop**. Wider layouts, tables, sidebars, and denser information are appropriate here.

### Data Flow Pattern

**POS page** (`app/pos/page.tsx`) is a server component that fetches dishes and payment methods from Prisma, then passes them as props to `PosClient` (client component). All subsequent interactions from the POS use fetch calls to API routes.

**Admin pages** are all `"use client"` components that fetch from API routes via `useEffect` on mount.

### Key Library Files

- `lib/prisma.ts` — Prisma singleton (prevents multiple instances in dev hot-reload)
- `lib/session.ts` — iron-session config (`dona_arepa_session` cookie)
- `lib/getSession.ts` — reads session in Server Components / middleware
- `lib/requireSession.ts` — validates session in API Route Handlers, returns 401 if unauthenticated

### Database Models (schema.prisma)

- **User / Session** — authentication
- **PaymentMethod** — configurable payment methods (cash vs. non-cash flag)
- **Denomination** — bill/coin denominations for cash counting
- **Ingredient / IngredientProduct / IngredientBatch** — inventory with FIFO cost tracking; `IngredientProduct` stores pack price/qty, `IngredientBatch` tracks remaining stock per purchase lot
- **Dish / RecipeItem** — menu items with ingredient recipes and categories (`STARTER`, `MAIN`, `DRINK`, `ADDON`)
- **Sale / SaleItem / Payment / CashLine** — sales records with line items, multi-method payments, and denomination breakdown
- **CashSession / CashExpense** — cash register sessions (open/close turns) with expenses
- **Counter** — used for sequential ticket numbering

### Sales Processing (`app/api/sales/route.ts`)

The POST handler is the core business logic:
1. Requires an open `CashSession` (status `"OPEN"`)
2. Calculates `totalCost` from ingredient recipes using pack price/qty ratio
3. Supports `customItems` (ad-hoc items with explicit ingredients — no `Dish` record created)
4. Creates Sale + SaleItems + Payments in a single Prisma transaction
5. Decrements ingredient stock and FIFO batches **outside** the transaction (failures are logged but don't roll back the sale)

### `isManagement` Sales

Sales with `isManagement: true` are internal/management orders — no payment is recorded, and they appear separately in session reports.
