# Antoine — the TaxMon Colony game

*Wag kang pahuhuli!*

Antoine is the game layer over TaxMonWeb's verified work facts (decisions
L-107 to L-113 in `00A-DECISION-REGISTER.md`; rules in
`08-COLONY-GAME-PROPOSAL.md`; design in `09-COLONY-MOBILE-DESIGN-SYSTEM.md`).

- Separate Next.js app and Vercel project (`antoine`, root directory `antoine/`).
- Same Supabase project and accounts as TaxMonWeb. Antoine only reads work
  facts and writes its own `colony_*` tables. It never marks work done.
- Currently runs on clearly labelled **sample data** (`src/lib/sample-data.ts`)
  until the Colony tables and shadow scoring exist.

## Run locally

```bash
cd antoine
npm install
npm run dev      # http://localhost:3200
npm run build && npm start
```

Checks: `npm run typecheck`, `npm run lint`.
