# 08 — Colony: Gamification, Leaderboards and the Ant Economy

Status: **PROPOSAL v2.** L-107 (individual leaderboards) and L-108 (rewards
governed by the Culture and Values Committee) are approved and recorded in
`00A-DECISION-REGISTER.md`. The detailed rules below reflect the HOD's
2026-11-06 intake answers and are pending final HOD sign-off. No migration
has been written. Design language: `09-COLONY-MOBILE-DESIGN-SYSTEM.md`
(pending mockup). Research basis: `10-GAME-MECHANICS-STUDY.md`.

---

## 1. Purpose and boundary

Colony turns clean, on-time, evidenced compliance work into a game:

- XP, demerits and ant colony ranks;
- individual leaderboards, realtime and historical;
- **Anay**, a co-op boss beaten by filing one day early;
- **Ants**, an in-app currency spent in in-app stores, some of which hand out real items.

Colony is a **read-only projection plus append-only ledgers**. It:

- never writes to operational tables (work, gates, evidence, QA, deadlines, profiles);
- never blocks, speeds up or changes a compliance command;
- never creates a second tracker. Every XP event and Ant movement points to the operational record or order behind it;
- if Colony fails, compliance work continues unaffected.

Spine position: `… → Completion → Independent QA → (Colony projection)`.

---

## 2. Decisions

| Ref | Status | Decision |
|---|---|---|
| L-107 | ✅ Approved 2026-11-06 | Individual leaderboards permitted (supersedes L-069) |
| L-108 | ✅ Approved 2026-11-06 | Culture and Values Committee governs real-value rewards |
| Intake 1 | HOD answer | Rank by **raw XP**, with **demerits for misses** |
| Intake 2 | HOD answer | Everyone competes on **role boards**. HOD is an **observer** |
| Intake 3 | HOD answer | **Colony never waits for QA.** XP is final when earned. QA later adds **bonus or demerit only** |
| Intake 4 | HOD answer | Ants **never expire** |
| Intake 5 | HOD answer | **Real names** on boards |
| Intake 6 | HOD answer | An **in-app economy**: a **Store Manager** role runs stores. Players pay Ants into a store. Real items are handed over outside the app, and the handover is tracked inside it |
| Intake 7 | HOD answer | Mascot: **Tonyo** |
| Intake 8 | HOD answer | **Anay** pushes filing **one day before** the deadline (D-1) |
| Intake 9 | HOD answer | **Sassy mode** is opt-in, off by default |
| Intake 10 | HOD answer | Adopt the recommended features from the game study (§4.10) |
| Intake 11 | HOD answer | Approve the design language after seeing the mockup |
| Follow-up 1 | HOD answer | **D-1 = one working day** before the adjusted statutory deadline (weekends and `holiday_master` holidays skipped) |
| Follow-up 2 | HOD answer | A miss gives the demerit to **every staff member who touched that work item** |
| Follow-up 3 | HOD answer | **One store**, run by **Lourdes** as first Store Manager. **Leaders can give merit points** |
| Follow-up 4 | HOD answer | **HOD can seed Ants.** Player transfers are built, but **locked for most players** by a background setting |
| Follow-up 5 | HOD answer | Store Managers compete on the boards |
| Pending | Needs HOD sign-off | Mobile design language (amends "corporate and controlled" in `05` for mobile/game surfaces) |

---

## 3. Players: start basic (reuse, do not rebuild)

No new user model. Colony reads what already exists:

| Need | Existing source |
|---|---|
| Person | `app_users` |
| Role label, active dates | `team_member_profiles` |
| Client assignment | `client_team_assignments` (portfolio owner / preparer / checker / reviewer) |
| Unit-level assignment | `registration_unit_team_assignments` |
| Who actually did the work | `generated_work_gate_attempts.actor_id`, `generated_work_evidence.actor_id`, `generated_compliance_work_events.actor_id` |
| Permissions (Store Manager etc.) | `capabilities` + `user_capability_assignments` (new capability keys only) |

Rules:

- **No clustering yet.** No teams or org-unit leagues. The existing structures allow them later.
- **Points follow the actual actor, not the assignee.** Assignment decides whose list it's on. Actor history decides who earns.
- **Client assignment is for scope only** ("people on my clients"), never a multiplier.

### 3.1 Role classes

| Operational role | Colony class | Board |
|---|---|---|
| Preparer | **Forager** | Forager board |
| Checker | **Sentinel** | Sentinel board |
| Reviewer | **Elder** | Elder board |
| Portfolio owner | **Steward** | Steward board |

A person earns in every class they actually act in. There's also an **Overall**
board (all XP), plus one board per class, so a checker is never ranked against
a preparer's volume unless they choose the Overall view.

---

## 4. Game rules

### 4.1 XP and Ants: final when earned

- **XP** is reputation. It drives leaderboards and ranks. Never spent.
- **Ants** are currency. Minted **1:1 with positive XP**, at the same moment.
- **Demerits** subtract XP and burn the same number of Ants.
- Nothing waits for QA. QA outcomes arrive later as their own bonus or demerit events.
- An Ant balance can go negative after a demerit. **Purchases are blocked while negative.**

### 4.2 What earns XP

Values are starting proposals, calibrated in shadow mode (§9, G1).

| Code | Class | Trigger (existing facts) | XP |
|---|---|---|---|
| `FIRST_PASS` | Forager | Work passes checking and review with no `return` in `generated_work_gate_attempts` | 30 |
| `CHECK_ON_TIME` | Sentinel | Checker `approve` recorded by D-2 | 15 |
| `REVIEW_ON_TIME` | Elder | Reviewer `approve` recorded by D-2 | 15 |
| `FILED_ACCEPTED` | Forager / Sentinel / Elder | Filing evidence with `result_status` `accepted` or `validated`, `external_date` ≤ adjusted statutory deadline | 40 / 15 / 15 |
| `ANAY_HIT` | Forager / Sentinel / Elder | Same as above, but filed **by D-1** (§4.5) | +20 each, on top |
| `PAID_CONFIRMED` | Payment step owner | Payment evidence with proof, ≤ deadline | 20 |
| `BLOCKER_RAISED_EARLY` | Whoever logged it | Blocker logged ≥ 3 days before D-1 and later resolved. Max one per work item | 10 |
| `QA_CLEAN` | All three actors | QA status `cleared` on sampled work | 25 each |
| `REMEDIATION_VALIDATED` | Accountable user | QA finding reaches `validated` | 15 |
| `STEWARD_ALL_CLEAR` | Steward | Every item on their clients this cycle filed by D-1 | 50 |
| `ANAY_DEFEATED` | Every competing player | Colony beats Anay this cycle (§4.5) | 50 |
| `CLEAN_STREAK` | Person | Consecutive cycles with zero misses and zero QA demerits | 50 × streak (cap 5) |
| `LEADER_MERIT` | Any player | A leader gives merit from their allowance, with a category and reason (§4.9) | 10–100 per award |

Nothing is awarded for submission alone (Submitted ≠ Accepted), filing without
required payment (Filed ≠ Paid), payment initiation (initiated ≠ confirmed),
raw item count without a quality condition, or overrides (§6).

### 4.3 Demerits

| Code | Who | Trigger | XP |
|---|---|---|---|
| `MISSED_D1` | **Everyone who touched the item** | Not filed by D-1 | −10 each |
| `MISSED_STATUTORY` | **Everyone who touched the item** | `statutory_deadline_missed` becomes true | −100 each |
| `QA_LOW` / `QA_MEDIUM` / `QA_HIGH` / `QA_MATERIAL` | Accountable user on the QA finding | Finding recorded | −10 / −30 / −60 / −150 |
| `STREAK_BROKEN` | Person | No XP loss; the streak resets | 0 |

**"Touched"** = anyone recorded as actor on that work item's gate attempts, evidence or work events during the cycle (actual-actor history, not assignment). Shared demerits make the item everyone's problem: a preparer has a reason to chase a slow reviewer and vice versa.

**Waiver (fairness):** a miss demerit is **waived** if an external blocker
(client data, client approval, payment funding or BIR system) was logged
**before** the missed date and was still open at that date. This also rewards
raising blockers early. Waivers are automatic from the record, are visible on
the player's history, and cannot be granted by hand.

**Never demerited:** raising a blocker or exception, or self-disclosing an
error before QA finds it (self-disclosure cancels any QA demerit for that issue).

### 4.4 Leaderboards and seasons

| Board | Window | Notes |
|---|---|---|
| **Live** | Current monthly filing cycle | Updates as facts land |
| **Colony Cup** | Quarter | Main competitive season, with seasonal ranks and stars |
| **Hall of the Colony** | All-time and annual | End-to-end history |

- Each board has Overall plus Forager / Sentinel / Elder / Steward tabs.
- Rows show **XP and clean rate** (% of the person's items on time, evidenced and with no QA demerit).
- **Ties:** same XP → higher clean rate → earlier last award.
- **Season end:** standings are snapshotted at the season's end date and never change. Later QA bonuses or demerits count in the season in which they're recorded.
- **Promotion only:** no demotion leagues, no bottom list, no "last place" anywhere. Boards show the top 10 plus your own pinned position.

### 4.5 Anay, the co-op boss

Anay is a fictional termite that eats the colony's foundations, standing for
late filings and penalties.

- **Each cycle Anay has HP** equal to the number of in-scope work items due that cycle.
- **A hit** = an item filed and accepted **by D-1** (one day before its adjusted statutory deadline). One HP per item.
- Items filed on time but after D-1 do no damage. Late items **heal Anay by 1**.
- **Victory:** HP reaches 0 by the cycle's last D-1 → **All Clear**, `ANAY_DEFEATED` for every competing player, and a podium of top hitters.
- **Defeat:** Anay "survives" the cycle. No group penalty. Next cycle is a new fight.
- The Anay bar is shown on the Anthill home screen, on the Tower and in Tower TV mode.
- **D-1 = one working day** before the adjusted statutory deadline. Weekends and holidays in `holiday_master` are skipped (e.g. a Monday deadline → D-1 is the previous Friday, or earlier if that Friday is a holiday). If the holiday calendar for that date is unresolved, D-1 shows as unresolved and no `ANAY_HIT` or `MISSED_D1` is decided until it's resolved.

### 4.6 Ant colony ranks (lifetime XP)

| # | Rank | Lifetime XP (proposal) |
|---|---|---|
| 1 | Larva | 0 |
| 2 | Worker Ant | 500 |
| 3 | Forager | 1,500 |
| 4 | Tunneler | 4,000 |
| 5 | Soldier Ant | 8,000 |
| 6 | Scout Captain | 15,000 |
| 7 | Colony Elder | 30,000 |
| 8 | Colony Keeper | 60,000 |

Lifetime rank uses **lifetime positive XP**. Ranks are milestones and never
drop. Demerits affect leaderboards and Ants, not milestones. **Seasonal ranks**
(Colony Cup) use stars within each rank and soft-reset each quarter.

### 4.7 The Ant economy

An in-game economy, like the stores in MLBB or PUBG, except some items are real.

**Wallets (double-entry):**

| Wallet | Owner | Purpose |
|---|---|---|
| Player wallet | Each player | Earn and spend |
| Store wallet | Each store (not a person) | Receives payments. Cannot buy anything |
| Colony Treasury | System | Mints Ants (faucet) and receives burned or retired Ants (sink) |

Every movement is one transaction with balanced entries, so the sum across all
wallets is always zero. **Ants in circulation = −Treasury balance.** Nothing is
ever created or destroyed off the books.

**Flows:**

| Flow | Entries |
|---|---|
| Earn (positive XP) | Treasury −X → Player +X |
| Demerit | Player −X → Treasury +X |
| Purchase (pending) | Player −price → Store +price, held until fulfilled |
| Fulfilled | Store −price → Treasury +price (Ants retired) |
| Rejected / cancelled | Store −price → Player +price (refund) |

**Stores and the Store Manager:**

- A **Store Manager** (new capability `colony.store_manage`) creates and runs stores, such as a "Culture & Values Store". Store Managers are staff picked by the committee.
- **Items** are either:
  - **digital**: ant skins, frames, titles, streak freezes. Delivered instantly by the app; the Treasury is the store.
  - **real**: gift certificates, merch, perks. Handed over **outside** the app by the store's manager.
- Each real item carries an Ant price, and optionally a **peso value**, recorded for the committee's budget reporting.
- **Buying a real item:** player buys → Ants move to the store (pending) → the Store Manager hands over the item in real life → marks the order **fulfilled** with a handover note → Ants are retired. Rejected or cancelled orders refund automatically.
- **Separation:** a Store Manager can't buy from a store they manage or fulfil their own order. Another manager or a committee member must act.
- **Conversion to real value happens outside the app** (committee decision). Inside the app it is always tracked as an order with a peso snapshot.

**Seed money (HOD):**

- The HOD (capability `colony.seed_grant`) can mint Ants from the Treasury into a player or store wallet: welcome grants, event prizes, a store float.
- Every seed needs a reason, appears in the economy view and counts toward the committee's liability.
- An optional co-approval threshold (off by default) can require a committee member to approve seeds above a set amount.

**Transfers (built, locked):**

- The ledger supports player-to-player transfers as a feature.
- A background setting (`colony_economy_settings`) controls it: **off for everyone by default**, with an allowlist of who may send, per-transfer and daily caps, and whether a reason is required. Only Super Admin / HOD can change it; changes are audited.
- While locked, players don't see a transfer button at all. **Kudos** (free, positive, no XP) remains the everyday gesture.
- Why locked: transfers make points-for-cash side deals, pressure on juniors and collusion possible. Open it deliberately, e.g. for a specific event, with caps.

**Committee economy view:**

- Ants minted, burned, spent and in circulation.
- Outstanding **liability** in pesos = Ants in circulation × the committee's reference rate (HOD example: 10,000 Ants ≈ ₱100).
- Per-store sales and pending orders.

Because Ants never expire, this liability only grows unless spent. The
committee should watch it each quarter.

### 4.8 Personality

- **Tonyo** is the mascot. He's warm, cheeky and proud of the colony. Character guide goes in `09`.
- **Sassy mode:** Duolingo-style teasing reminders. Each player opts in themselves; off by default.
- **Anay** is the shared villain (§4.5). No real person is ever a character or villain.

### 4.9 Leader merit points

Leaders (`role_key = leader`, capability `colony.merit_give`) can recognise things the system can't see: helping a teammate, client praise, mentoring, going beyond.

- **Allowance:** each leader gets a merit allowance per cycle (proposal: 300 XP). Unused allowance doesn't roll over.
- **Per award:** 10–100 XP (and the same Ants), a **category** (Helped a teammate · Client praise · Mentoring · Went beyond · Other) and a **reason** of at least a sentence.
- **Limits:** never to yourself; at most 100 XP from one leader to one person per cycle.
- **Visibility:** the recipient sees who gave it and why. Merits show in the Colony Feed as "Recognised by {leader}" (opt-out respected). The HOD gets a monthly merit report per leader and recipient, to spot favoritism.
- Merit is never used to cancel a demerit. Recognition and accountability stay separate.

### 4.10 Adopted features (from `10` §6)

Role classes and boards · Anay raid · Cycle MVP + rare medals ("Perfect Cycle",
"Blocker Buster") · seasonal ranks with stars and soft reset · streak freeze
(a digital store item) · Forage Missions (pick 3 of 5 weekly) · Badge Album ·
cosmetics (ant skins, frames, titles) · free Colony Pass · budget-capped Rush
Events · welcome-back boost and rookie bracket · Anthill home screen · three
cycle rings (Filed on time · Evidence complete · QA clean) · Tower TV mode ·
kudos.

---

## 5. Data model (new tables)

`colony_` prefix in `public`. RLS on every table, deny-by-default. Writes only
through `security definer` commands. Balances, standings, ranks and Anay HP are
**derived views**, never editable columns.

### 5.1 Players and permissions

**`colony_player_profiles`**: `user_id` PK → `app_users`, `leaderboard_name`
(defaults to `display_name`), `participation` (`competing` / `observer` / `excluded`),
`excluded_reason`, `sassy_mode` (bool, default false), `feed_opt_out` (bool),
`joined_at`, `updated_at`, `updated_by`.

New capability keys in `capabilities`: `colony.rules_draft`, `colony.rules_approve`,
`colony.store_manage`, `colony.economy_view`, `colony.season_admin`,
`colony.merit_give`, `colony.seed_grant`, `colony.economy_settings`.

### 5.2 Configuration (effective-dated, maker-checker)

- **`colony_rule_set_versions`**: `id`, `version_no`, `effective_from/to`, `status` (`draft` / `approved` / `retired`), `mint_rate` (default 1), `blocker_early_days`, `streak_cap`, `drafted_by`, `approved_by` (≠ drafter), `approved_at`, `change_reason`.
- **`colony_award_rules`**: `rule_set_version_id`, `award_code`, `earner_class`, `xp` (negative for demerits), `active`, `description`. A lookup table, not a rules DSL. Trigger logic per code is reviewed code.
- **`colony_rank_tiers`**: `rule_set_version_id`, `tier_no`, `code`, `label`, `min_lifetime_xp`, `insignia_key`.

### 5.3 Seasons and Anay

- **`colony_seasons`**: `id`, `kind` (`filing_cycle` / `quarter` / `year`), `label`, `starts_on`, `ends_on`, `rule_set_version_id`, `status` (`scheduled` / `live` / `finalized`), `finalized_at`. No overlaps per kind.
- **`colony_season_final_standings`**: immutable snapshot. `season_id`, `board` (`overall` / `forager` / `sentinel` / `elder` / `steward`), `user_id`, `position`, `xp`, `clean_rate`, `items_count`. Unique (`season_id`, `board`, `user_id`).
- **`colony_anay_outcomes`**: per filing-cycle season. `season_id`, `starting_hp`, `final_hp`, `result` (`defeated` / `survived`), `decided_at`. HP during the cycle is a derived view.

### 5.4 XP ledger (append-only)

**`colony_xp_events`**: `id`, `user_id` (actual actor), `season_id`,
`award_code`, `earner_class`, `xp_delta` (±), `source_kind` (`gate_attempt` /
`evidence` / `qa_finding` / `work_event` / `season_rollup` / `adjustment`),
`source_id`, `generated_work_id`, `client_id`, `rule_set_version_id`,
`waived_by_blocker_id` (set when a demerit was waived; such rows carry
`xp_delta = 0`), `reverses_event_id` (only when the source fact itself is
corrected), `idempotency_key` **unique**, `reason` (required for adjustments),
`created_by` (null = projector), `created_at`.

Manual adjustments need a reason and a second approver, never target the
requester, and show as "Adjusted" in history.

### 5.5 Ant ledger (double-entry, append-only)

- **`colony_economy_settings`**: effective-dated, one live row. `transfers_enabled` (default false), `transfer_allowed_capability` (who may send), `transfer_max_per_txn`, `transfer_max_per_day`, `transfer_reason_required`, `seed_coapproval_threshold` (nullable = off), `reference_peso_per_10k_ants` (default 100), `changed_by`, `changed_at`, `change_reason`.
- **`colony_wallets`**: `id`, `kind` (`player` / `store` / `treasury`), `user_id` (player), `store_id` (store). Exactly one treasury.
- **`colony_ant_transactions`**: `id`, `kind` (`mint` / `burn` / `seed` / `transfer` / `purchase_hold` / `purchase_retire` / `purchase_refund` / `adjust`), `initiated_by`, `coapproved_by`, `xp_event_id`, `order_id`, `idempotency_key` unique, `reason`, `created_by`, `created_at`.
- **`colony_ant_entries`**: `transaction_id`, `wallet_id`, `amount` (±). A deferred constraint ensures each transaction sums to zero.
- **Views:** `colony_wallet_balances`, `colony_economy_summary` (minted, burned, retired, circulating, liability).

### 5.6 Stores and orders

- **`colony_stores`**: `id`, `name`, `description`, `active`, `created_by`, `created_at`.
- **`colony_store_managers`**: `store_id`, `user_id`, `effective_from/to`, `assigned_by`.
- **`colony_store_items`**: `id`, `store_id` (null = Treasury digital store), `kind` (`digital` / `real`), `digital_item_code` (skins, frames, titles, `streak_freeze`), `label`, `ant_price`, `peso_value` (nullable), `stock` (nullable = unlimited), `effective_from/to`, `created_by`, `approved_by`. A price change supersedes the row instead of editing it.
- **`colony_orders`**: `id`, `buyer_user_id`, `store_id`, `store_item_id`, `ant_price_snapshot`, `peso_value_snapshot`, `status` (`pending` / `fulfilled` / `rejected` / `cancelled`), `hold_transaction_id`, `settle_transaction_id`, `decided_by` (≠ buyer; not a manager of a store they bought from for their own order), `decided_at`, `handover_note` (never a gift-card code or PIN), `version` (optimistic concurrency), `created_at`. Status changes are also written to `audit_events`.
- **`colony_inventory`**: `user_id`, `digital_item_code`, `order_id`, `acquired_at`, `equipped` (bool). Cosmetics a player owns.

### 5.6a Merit

- **`colony_merit_allowances`**: `leader_user_id`, `season_id`, `allowance_xp`, `set_by`. Unique per leader and season.
- Merit awards are rows in `colony_xp_events` with `award_code = LEADER_MERIT`, `source_kind = merit`, plus `merit_category` and `given_by`. Remaining allowance is a derived view.

### 5.7 Later-Lego tables (reserved, not built now)

`colony_missions` + `colony_mission_progress` (metric type + target + window +
reward), `colony_events` (window + multiplier + Ant cap), `colony_pass_tiers` +
`colony_pass_progress`, `colony_badge_definitions` + `colony_badge_awards`,
`colony_medals`, `colony_kudos` (from, to, optional work link, daily cap, no XP).

### 5.8 Derived views

`colony_live_standings`, `colony_season_standings`, `colony_player_progress`
(lifetime XP, rank, next rank, streak, rings), `colony_anay_live` (HP, hits,
heals), `colony_wallet_balances`, `colony_economy_summary`.

---

## 6. Guardrails: what must never be gamified (mandatory)

1. **No XP without verified facts.** Only accepted/validated results with evidence earn.
2. **No speed contests beyond D-1.** Filing earlier than D-1 earns nothing extra.
3. **No SoD shortcuts.** Self-check and self-review are impossible in operations and earn nothing.
4. **Elevated Override earns zero** for any gate it passed, and the work's history shows "Override".
5. **RAG is never a personal score** (locked in `04-RBAC.md`). Colony reads deadlines and evidence dates, not RAG.
6. **No bounty on QA.** QA reviewers never earn from findings they raise.
7. **No penalty for raising problems.** Blockers, exceptions and self-disclosed errors never cost XP.
8. **Colony never blocks work** and never waits on or alters compliance commands.
9. **No self-dealing.** No self-adjustment, no buying from your own store, no fulfilling your own order.
10. **History is append-only.** Corrections are reversal entries. Final standings never change.
11. **No public bottom.** Top 10 plus your own position only. Demerits are visible to the player and authorized managers, never on a public board.
12. **No real person as a character or villain.** No subjective ratings of BIR officers anywhere (existing rule).
13. **Real items stay inside the committee's budget and process.** The app records orders and handovers; it never stores gift-card codes or PINs.
14. **Transfers stay locked** unless deliberately enabled with caps; seed grants always carry a reason.
15. **Merit is capped, reasoned and reported.** It never offsets a demerit and can't be self-given.

---

## 7. How awards are produced

- **Projector:** an idempotent `colony_project_awards(since)` reads new operational facts and writes XP events plus their Ant transactions, keyed by `idempotency_key`. Safe to re-run.
- **When it runs:** best-effort after successful work commands (outside their transaction), plus a scheduled sweep (Vercel Cron) as backstop. It also evaluates D-1 and deadline misses as dates pass. **No triggers on operational tables.**
- **Realtime:** first version refreshes on screen focus and every 30–60 seconds. Supabase Realtime later. No Redis, queues or workers.
- **Season close:** at `ends_on`, a scheduled, idempotent close writes the final standings and the Anay outcome.

---

## 8. Authorization

| Action | Who |
|---|---|
| View boards, Anay, stores | All authenticated staff |
| View own XP, demerits, Ants, orders | The player |
| View another player's detail (incl. demerits) | HOD, Super Admin |
| Draft / approve rule sets | `colony.rules_draft` / `colony.rules_approve` (different people) |
| Season admin | `colony.season_admin` (HOD / Super Admin) |
| Manual XP or Ant adjustment | Requested by HOD / Super Admin, approved by a second authorized person, never self-targeted |
| Create and run stores, fulfil orders | `colony.store_manage`, assigned to the store, never for own orders |
| Economy view | `colony.economy_view` (committee, HOD) |
| Give merit | `colony.merit_give` (leaders), within allowance, never to self |
| Seed Ants | `colony.seed_grant` (HOD), reason required |
| Change economy settings (transfers, caps, rate) | `colony.economy_settings` (HOD / Super Admin), audited |

Enforced server-side and by RLS. UI visibility is never the control.

---

## 9. Build sequence (Lego-sized, HOD review gate after each)

Colony starts after the work lifecycle produces real gate, evidence and QA facts
on sanitized data.

| Lego | Delivers |
|---|---|
| **G1 Shadow scoring** | Rule sets, award rules (incl. demerits and waivers), seasons, XP ledger, projector. HOD-only calibration report |
| **G2 Live boards + Anay** | Player profiles, role classes, live standings, Anay live HP, Anthill home, Tonyo |
| **G3 Seasons + ranks** | Season close, final standings, Colony Cup, Hall, lifetime and seasonal ranks, streaks, MVP and medals |
| **G4 Ant wallet** | Double-entry ledger, minting and burning, seed grants, locked transfers + economy settings, leader merit, committee economy view |
| **G5 Stores** | Store Manager capability, stores, items, orders, fulfilment, digital inventory (cosmetics, streak freeze) |
| **G6 Live-ops** | Forage Missions, Colony Pass, Rush Events, Badge Album, kudos, Tower TV mode |

Tests for every Lego, positive and negative: idempotent re-projection;
duplicate commands; no XP for self-review or override; demerit waiver only
with a prior external blocker; double-entry balance always zero; purchase
blocked on negative balance; transfer refused while locked or over cap; merit over allowance or to self refused; D-1 skips weekends and holidays; shared demerit reaches every actor; Store Manager can't fulfil own order; refunds on
rejection; RLS denial of others' detail; final standings immutable; Colony
outage doesn't affect work commands.

---

## 10. Open questions for the HOD

1. **Merit allowance:** 300 XP per leader per cycle, 10–100 per award, to start?
2. **Seed co-approval:** keep off, or require a committee member above a set amount?
3. **Shared demerit size:** everyone gets the full −10 / −100 (current), or the person holding the open step gets the full amount and others a smaller share?
