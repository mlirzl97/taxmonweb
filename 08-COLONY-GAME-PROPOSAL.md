# 08 — Colony: Gamification, Leaderboard and Ant Rewards

Status: **PROPOSAL — L-107 (individual leaderboards) and L-108 (rewards governance) approved 2026-11-06; detailed rules still pending HOD approval.** Nothing in this document is approved
until the HOD signs off the decision amendments in §2. No migration has been
written. This document amends, but does not silently override, `00A-DECISION-REGISTER.md`.

Working name: **Colony**. It is the game layer over TaxMonWeb's single
operational truth.

---

## 1. Purpose and boundary

Colony makes clean, on-time, evidenced compliance work visible and rewarding.
It does this through:

- XP earned from verified work facts;
- individual leaderboards, both realtime and historical;
- ant colony ranks;
- **Ants**, a currency that can be redeemed for real rewards.

Colony is a **read-only projection plus an append-only ledger**. It:

- never writes to operational tables (work, gates, evidence, QA, deadlines, profiles);
- never blocks, speeds up or changes a compliance command;
- never creates a second tracker. Every award points to the operational record that earned it;
- if Colony fails, compliance work continues unaffected.

Spine position: `… → Completion → Independent QA → (Colony projection)`.
Colony is downstream of everything and upstream of nothing.

---

## 2. Decision amendments required (HOD sign-off)

| Ref | Current | Proposed |
|---|---|---|
| **L-069 → L-107 ✅ approved 2026-11-06** | Team/Tower "Race to All Clear"; no public individual leaderboard in V1. | Individual leaderboards are permitted, both realtime (current filing cycle) and historical (settled seasons). The guardrails in §6 are mandatory. Race to All Clear stays as the Tower-level goal. Tax Run Completion, RAG, QA Completion, QA Pass Rate and RCA stay separate measures and are never merged into XP. |
| **L-108 ✅ approved 2026-11-06: Ant rewards** | — | Ants are a points currency backed by real rewards. The **Culture and Values Committee** governs the catalog, budget, approvals, fulfilment and any HR/payroll/tax treatment. The rate is configuration (HOD example: 10,000 Ants = one ₱100 gift certificate). TaxMonWeb keeps the ledger and redemption record only. |
| **New: Mobile design language** | `05-UX-DESIGN-SYSTEM.md`: "corporate and controlled". | Mobile and game surfaces use the bolder Colony design language (`09-COLONY-MOBILE-DESIGN-SYSTEM.md`). Control facts keep their precise, plain-language presentation inside it. Desktop keeps the existing system unless separately amended. |
| **Build plan note** | `07` People Lego: "No HR, payroll, ranking, or gamification data." | That stays true for the People Lego. Colony is its own later set of Legos (§9), built after the work lifecycle produces real facts. |

L-107 and L-108 are recorded in the decision register. The mobile design language row is still pending; until it is approved, Colony work is limited to documentation, calibration and mockups.

---

## 3. Users: start basic (reuse, do not rebuild)

No new user model. Colony reads what already exists:

| Need | Existing source |
|---|---|
| Who the person is | `app_users` (`display_name`, `is_active`) |
| Role label, active dates | `team_member_profiles` (`role_key`, `effective_from/to`) |
| Client assignment | `client_team_assignments` (`portfolio_owner / preparer / checker / reviewer`, effective-dated) |
| Unit-level assignment | `registration_unit_team_assignments` |
| Who actually did the work | `generated_work_gate_attempts.actor_id`, `generated_work_evidence.actor_id`, `generated_compliance_work_events.actor_id` |

Rules:

- **No clustering yet.** No teams, pods or org-unit competitions. `organization_units` and `client_groups` are ignored by Colony for now. They exist, so team leagues can be added later without a schema change.
- **Points follow the actual actor, not the assignee.** Assignment decides whose list the work appears on. Actor history decides who earns from it. This mirrors the SoD rule.
- **Client assignment is used for scope only**, e.g. "leaderboard among people on my clients". It is never used as a multiplier.

The only new per-user record is `colony_player_profiles` (§5.1), for game-specific settings.

---

## 4. Game rules (recommended)

### 4.1 Two numbers, not one

| | **XP** | **Ants** |
|---|---|---|
| Meaning | Reputation and progress | Spendable currency |
| Drives | Leaderboards, colony rank | Reward redemption |
| Earned | Realtime, as *provisional*; becomes *settled* at season close | Only from **settled** XP |
| Goes down? | Only by QA clawback or a reversed source fact | By clawback, by redemption, and by expiry if expiry is enabled |
| Spent? | Never | Yes |

Keeping them separate means a realtime leaderboard can be exciting without
paying real money for work that QA later finds wrong.

### 4.2 What earns XP (all derived from existing facts)

Point values are **starting proposals, to be calibrated in shadow mode (§9, G1)**.

| Award code | Earned by | Trigger (existing source) | XP |
|---|---|---|---|
| `PREP_FIRST_PASS` | Preparer | Work passes checking **and** review with no `return` decision in `generated_work_gate_attempts` | 30 |
| `CHECK_DONE_ON_TIME` | Checker | Checker `approve` recorded before `tmf_package_target` | 15 |
| `REVIEW_DONE_ON_TIME` | Reviewer | Reviewer `approve` recorded before `tmf_package_target` | 15 |
| `FILED_ACCEPTED_ON_TIME` | Preparer, checker, reviewer | Filing evidence with `result_status` in (`accepted`, `validated`) and `external_date` ≤ `adjusted_statutory_deadline` | 40 / 15 / 15 |
| `PACKAGE_TARGET_MET` | Preparer | Filing evidence dated ≤ `tmf_package_target` | 20 |
| `PAID_CONFIRMED_ON_TIME` | Payment step owner | Payment evidence with proof, dated ≤ deadline | 20 |
| `EARLY_BLOCKER_RAISED` | Raiser | Data-readiness or other blocker logged ≥ *N* days before package target and later resolved (one per work item) | 10 |
| `QA_CLEAN` | All three actors | QA finding status `cleared` on sampled work | 25 each |
| `REMEDIATION_VALIDATED` | Accountable user | QA finding moves to `validated` | 15 |
| `CLEAN_CYCLE_STREAK` | Person | A cycle with zero late items and zero QA findings, consecutive | 50 × streak (capped at 5) |

**Nothing is awarded for:** submission alone (Submitted ≠ Accepted), filing
without payment where payment applies (Filed ≠ Paid), payment initiation
(initiated ≠ confirmed), raw item count with no quality condition, or speed
beyond meeting the target.

### 4.3 What takes XP away

| Event | Effect |
|---|---|
| QA finding `low` / `medium` | Clawback: that work's awards to its actors are reversed |
| QA finding `high` / `material` | Clawback, plus a deduction of 50 / 150 XP from the accountable user |
| Statutory deadline missed | That work earns nothing. Streak broken. No extra deduction |
| Source fact reversed or superseded (e.g. evidence corrected) | Matching award reversed automatically |
| **Self-disclosed error before QA** | Award reversed, **no deduction**. People should never be punished for reporting their own mistakes |

### 4.4 Seasons and leaderboards

| Board | Window | Counts | Purpose |
|---|---|---|---|
| **Live: This filing cycle** | Current monthly cycle | Provisional + settled XP | Realtime excitement during deadlines |
| **Colony Cup** | Quarter | Settled XP only | Main competitive season |
| **Hall of the Colony** | All-time / annual | Settled XP only | End-to-end historical record |

- **Settlement:** a monthly season is finalized after its QA window closes (a configurable number of days after cycle end). Final standings are snapshotted and never change. A later clawback is a new entry in the *current* season, not an edit to history.
- **Fairness display:** each row shows XP **and clean rate** (% of the person's items that were on time, evidenced and free of QA findings). Ranking is by XP; clean rate keeps volume from looking like quality. Normalizing by client load is an open calibration question (§10).
- **Ties:** same XP → higher clean rate → earlier time of last settled award.

### 4.5 Ant colony ranks (lifetime settled XP)

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

Ranks never go down from a clawback, because they are milestones. The
leaderboard reflects the clawback instead. The thresholds are effective-dated
configuration.

### 4.6 Ants and rewards

- **Issuance:** when an award settles, Ants = XP × issuance rate (proposal 1:1). Deductions debit Ants too.
- **Rate is configuration:** the HOD example of 10,000 Ants = ₱100 gift certificate implies 1 Ant = ₱0.01. Catalog items carry their own Ant cost, so the rate can change per item without rewriting history.
- **Budget control:** each season has an **issuance cap** (₱ budget ÷ value per Ant). If the cap is reached, XP still counts but Ants issue at a reduced, visibly stated rate. Real money never exceeds the approved budget.
- **Redemption:** player requests → approver (≠ player, maker-checker) approves → fulfiller records that it was handed over outside TaxMonWeb. Rejected or cancelled requests release the hold.
- **Negative balance:** a post-settlement clawback can push Ants below zero. Redemption is blocked until the balance is positive again.
- **No transfers, gifting or trading** between players.
- **Expiry:** off by default. If enabled, it is announced and configured per season.

---

## 5. Data model (new tables)

All tables use the `colony_` prefix in `public`, matching the existing
migration convention, and keep a clear module boundary. Every table has RLS
enabled, deny-by-default. Writes go through `security definer` commands only.
Balances, standings and ranks are **derived views, never editable columns**.

### 5.1 Players

**`colony_player_profiles`**: one row per participating user.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK → `app_users` | |
| `leaderboard_name` | text | Defaults to `display_name`. Editable by the player within naming rules |
| `participation` | text | `competing`, `observer` (sees boards, not ranked), `excluded` |
| `excluded_reason` | text | Required when `excluded` |
| `joined_at`, `updated_at`, `updated_by` | | |

Recommended default: the **HOD and anyone who approves rewards or adjusts
scores is `observer`**, to avoid conflicts of interest. QA reviewers may compete,
but can never earn from findings they raised (§6).

### 5.2 Configuration (effective-dated, maker-checker)

**`colony_rule_set_versions`**: `id`, `version_no`, `effective_from`,
`effective_to`, `status` (`draft` / `approved` / `retired`), `issuance_rate`,
`qa_window_days`, `streak_cap`, `drafted_by`, `approved_by` (≠ drafter),
`approved_at`, `change_reason`.

**`colony_award_rules`**: `rule_set_version_id`, `award_code`,
`earner_role` (`preparer` / `checker` / `reviewer` / `payment_owner` / `raiser` / `accountable`),
`xp`, `active`, `description`. This is a plain lookup table, **not a rules DSL**.
The trigger logic for each award code lives in reviewed SQL/TypeScript.

**`colony_rank_tiers`**: `rule_set_version_id`, `tier_no`, `code`, `label`,
`min_lifetime_xp`, `insignia_key`.

### 5.3 Seasons

**`colony_seasons`**: `id`, `kind` (`filing_cycle` / `quarter` / `year`),
`label`, `starts_on`, `ends_on`, `rule_set_version_id`,
`status` (`scheduled` / `live` / `qa_window` / `finalized`),
`ant_issuance_cap`, `finalized_by`, `finalized_at`.
Constraint: no overlapping seasons of the same kind.

**`colony_season_final_standings`**: immutable snapshot written at finalize.
`season_id`, `user_id`, `position`, `settled_xp`, `clean_rate`, `items_count`,
`rank_tier_code`. Unique (`season_id`, `user_id`). No update or delete grants.

### 5.4 The XP ledger (append-only)

**`colony_xp_events`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → `app_users` | The **actual actor** |
| `season_id` | uuid → `colony_seasons` | Monthly season the fact belongs to |
| `award_code` | text | From `colony_award_rules`, or `CLAWBACK`, `DEDUCTION`, `ADJUSTMENT` |
| `xp_delta` | integer | Positive or negative |
| `state` | text | `provisional` → `settled` (via a settlement event row, not an update) |
| `source_kind` | text | `gate_attempt` / `evidence` / `qa_finding` / `work_event` / `season_rollup` / `manual_adjustment` |
| `source_id` | uuid | The operational row that earned it |
| `generated_work_id` | uuid → `generated_compliance_work` | For drill-down |
| `client_id` | uuid → `clients` | Denormalized for scoped boards |
| `rule_set_version_id` | uuid | Rules in force when awarded |
| `reverses_event_id` | uuid → self | Set on clawbacks and reversals |
| `idempotency_key` | text **unique** | e.g. `award_code:source_id:user_id`, so re-projection never double-awards |
| `reason` | text | Required for `ADJUSTMENT`, `DEDUCTION` and `CLAWBACK` |
| `created_by` | uuid | `null` = projector; a person for adjustments |
| `created_at` | timestamptz | |

Settlement is recorded by `colony_xp_settlements` (`season_id`, `xp_event_id`,
`settled_at`), so the event row itself never mutates.

**Manual adjustments** need a reason and a second approver, can never target
the requester, and show as "Adjusted" on the player's history.

### 5.5 The Ant wallet (append-only)

**`colony_ant_ledger`**: `id`, `user_id`,
`entry_kind` (`earn` / `clawback` / `deduction` / `redeem_hold` / `redeem_release` / `redeem_settle` / `expire` / `adjust`),
`amount` (signed integer), `xp_event_id`, `redemption_id`, `season_id`,
`idempotency_key` unique, `reason`, `created_by`, `created_at`.

The balance is the view `colony_ant_balances` = `sum(amount)` per user, with
available vs. held split by `entry_kind`.

### 5.6 Rewards

**`colony_reward_items`**: `id`, `label` (configured by Admin, e.g. a
gift-certificate denomination), `ant_cost`, `peso_value` (for budget
reporting), `stock` (nullable = unlimited), `effective_from`, `effective_to`,
`approved_by`, `created_by`. Supersede, don't edit: a price change is a new row.

**`colony_redemptions`**: `id`, `user_id`, `reward_item_id`,
`ant_cost_snapshot`, `peso_value_snapshot`,
`status` (`requested` / `approved` / `rejected` / `cancelled` / `fulfilled`),
`requested_at`, `decided_by` (≠ `user_id`), `decided_at`, `decision_note`,
`fulfilled_by`, `fulfilled_at`, `fulfilment_reference` (internal handover
note; never a gift-card code or PIN), `version` (optimistic concurrency).
Status changes are also written to `audit_events`.

### 5.7 Badges (later Lego, schema reserved)

**`colony_badge_definitions`** (`code`, `label`, `criteria_description`,
`insignia_key`, `active`) and **`colony_badge_awards`** (`user_id`,
`badge_code`, `season_id`, `source_xp_event_id`, `awarded_at`, unique per user
and badge and season).

### 5.8 Derived views (never tables)

| View | Purpose |
|---|---|
| `colony_live_standings` | Current filing cycle: provisional + settled XP, clean rate, position |
| `colony_season_standings` | Any season: settled XP only, until finalized; then the snapshot is read |
| `colony_player_progress` | Lifetime settled XP, current rank tier, XP to next rank, streak |
| `colony_ant_balances` | Available, held, lifetime earned |
| `colony_budget_usage` | Ants issued vs. cap per season, in Ants and ₱ |

---

## 6. Guardrails: what must never be gamified (recommended, mandatory)

1. **No XP without verified facts.** Only accepted/validated results with evidence earn. Submitted ≠ Accepted, Filed ≠ Paid, initiated ≠ confirmed.
2. **No speed contests.** Meeting the target earns; beating it by more earns nothing extra.
3. **No SoD shortcuts.** Self-check and self-review are impossible in operations and earn nothing in Colony.
4. **Elevated Override earns zero.** Any gate passed by override gives no XP to anyone for that gate, and the work shows as "Override" in its history.
5. **RAG is never a personal score.** Locked in `04-RBAC.md`. Colony reads deadlines and evidence dates, not RAG.
6. **No bounty on QA.** QA reviewers never earn from the number or severity of findings they raise.
7. **No penalty for raising problems.** Blockers, exceptions and self-disclosed errors never cost XP.
8. **Colony never blocks work.** A game failure cannot fail, delay or alter a compliance command.
9. **No self-awarding.** Adjusters and reward approvers cannot target themselves, and default to `observer`.
10. **History is append-only.** Corrections are reversal entries. Finalized standings never change.
11. **Leaderboards show work outcomes, not people's worth.** No "worst performer" view, no public bottom ranking. The live board shows the top 10 and your own position.
12. **Real rewards stay inside the committee's approved budget**, and redemption stays off until the Culture and Values Committee gives the go-ahead.

---

## 7. How awards are produced

- **Projector:** a single idempotent function `colony_project_awards(since timestamptz)` reads new operational facts and inserts `colony_xp_events` keyed by `idempotency_key`. Re-running it is safe.
- **When it runs:** (a) best-effort, right after a successful work command in the app server, outside the command's transaction; (b) a scheduled sweep as a backstop (Vercel Cron). **No database triggers on operational tables**, so a Colony bug cannot break a compliance write.
- **Realtime:** first version refreshes the live board on screen focus and every 30–60 seconds. Supabase Realtime (already part of the managed stack) is a later enhancement. No Redis, queues or workers.
- **Settlement job:** at `qa_window` end, the HOD (or an authorized role) runs *Finalize season*: write settlements → issue Ants up to the cap → snapshot standings → status `finalized`. Idempotent and audited.

---

## 8. Authorization

| Action | Who |
|---|---|
| View live and historical boards | All authenticated staff |
| View own XP, Ants and history | The player |
| View another player's detailed history | HOD, Super Admin |
| Draft rule set or rank tiers | HOD, Super Admin |
| Approve rule set | A different HOD / Super Admin from the drafter |
| Finalize season | HOD, Super Admin (audited) |
| Manual XP or Ant adjustment | Request: HOD / Super Admin; approve: a second authorized person; never self-targeted |
| Manage reward catalog | Culture and Values Committee members (maker-checker) |
| Approve redemption | Culture and Values Committee member ≠ requester |
| Mark redemption fulfilled | Culture and Values Committee fulfiller |

Enforced server-side and by RLS. UI visibility is never the control.

---

## 9. Build sequence (Lego-sized, each with an HOD review gate)

Colony starts only after the work lifecycle produces real gate, evidence and QA
facts on sanitized data.

| Lego | Delivers | Visible to staff? |
|---|---|---|
| **G1 Shadow scoring** | `colony_rule_set_versions`, `colony_award_rules`, `colony_seasons`, `colony_xp_events`, projector. HOD-only calibration report | No (HOD only) |
| **G2 Live leaderboard** | `colony_player_profiles`, `colony_live_standings`, mobile Live board | Yes |
| **G3 Seasons and history** | Settlement, final standings, Colony Cup, Hall of the Colony | Yes |
| **G4 Ranks and badges** | Rank tiers, progress, insignia, badges | Yes |
| **G5 Ant wallet** | Ant ledger and balances, earning only, no redemption | Yes |
| **G6 Rewards** | Catalog, redemption workflow, budget view. **Gated on Culture and Values Committee go-ahead** (they own HR/payroll/tax treatment) | Yes |

Each Lego ships with positive and negative tests: idempotent re-projection,
duplicate commands, no award for self-review or override, clawback on QA
finding, no Ants from provisional XP, redemption self-approval denied,
negative-balance block, RLS denial of other players' details, and finalized
standings immutable.

---

## 10. Open questions for the HOD

1. **Load fairness:** rank by raw XP (recommended to start), or normalize by client load or complexity? Raw XP rewards people carrying more clients. Normalizing is fairer but harder to explain.
2. **Real-reward budget:** set by the Culture and Values Committee. It becomes the issuance cap.
3. **Who competes:** should portfolio owners and reviewers compete alongside preparers, or have their own board?
4. **QA window length:** how many days after cycle end before a season can be finalized?
5. **Ant expiry:** never (recommended), or expire after N months?
6. **Leaderboard names:** real display names (recommended for a small team), or optional aliases?
7. **Committee in the system:** which staff accounts act for the Culture and Values Committee?
