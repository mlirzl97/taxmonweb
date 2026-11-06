# 09 — Colony Mobile Design System

Status: **PROPOSAL — pending HOD approval** (see `08-COLONY-GAME-PROPOSAL.md` §2).
Scope: TaxMonWeb mobile surfaces and all Colony (game) surfaces. Desktop keeps
`DESIGN.md` / `05-UX-DESIGN-SYSTEM.md` unless separately amended.

Inspiration: the HOD's Macau trip app, for its bold identity, framed
"stamp" cards, countdown band, day strip, one-tap scope and the raised centre
button. Colony takes the *qualities*, not the look. The ant is the identity.

---

## 1. Philosophy

**"A colony at work."** Many small, reliable actions add up to something
impressive. The app should feel alive, warm and a little proud of the team,
like a well-run colony, while every compliance fact stays exact.

### 1.1 Principles

1. **Two layers, one truth.** The **Control layer** (work, deadlines, evidence, status) is precise and plain. The **Game layer** (XP, Ants, ranks, boards) is playful and celebratory. The game layer may decorate around control facts. It may never restate, soften or overrule them.
2. **Celebrate verified outcomes only.** Confetti, sounds and level-ups fire on *verified* facts (accepted filing, confirmed payment, QA clean). Never on a click, a submission or an intention.
3. **Next safe action first.** Each screen answers in the first viewport: what needs me, what's urgent, how I'm doing.
4. **Bold, not loud.** Strong color blocks, heavy display type and framed cards. One focal point per screen. Brand red stays a signal.
5. **Thumb-first.** Primary actions sit in the bottom half. Nothing important needs two hands.
6. **Status never by color alone.** Every state carries a word, an icon or a shape.
7. **Respect people.** Leaderboards show winners and *your* position, never a public bottom list. Copy jokes with people, never at them.

### 1.2 Two voices

| | Control voice | Game voice |
|---|---|---|
| Where | Work cards, detail sheets, deadlines, evidence, errors | Boards, XP, Ants, ranks, celebrations, empty states |
| Tone | Exact, calm, short | Warm, playful, proud. Light Taglish OK ("Ang galing!", "Laban, colony!") |
| Example | "Filed · payment not confirmed" | "+40 XP — filed and accepted. Sipag!" |
| Never | Jokes, exaggeration, emoji | Restating or softening a compliance fact ("almost filed!") |

---

## 2. Tokens

### 2.1 Color

Contrast ratios below were checked against WCAG 2.x.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `ink` | `#1d1d1b` | Text, borders, dark surfaces, tab bar | 14.8:1 on `paper` |
| `paper` | `#f6efe0` | App ground (warm cream) | — |
| `card` | `#fffaf0` | Cards, sheets | — |
| `soil` | `#3b2a1e` | Secondary dark surface (Colony header, board band) | `paper` on it 11.9:1 |
| `antRed` | `#e31e24` | Primary action fill, Now button, urgent pill, active marker | white on it 4.7:1 |
| `antRedText` | `#b8191e` | Red **text** on light grounds | 5.7:1 on `paper` |
| `honey` | `#f0b429` | XP and Ant fills, progress bars, podium gold | `ink` on it 9.1:1; on `soil` 7.3:1 |
| `honeyText` | `#8a5a00` | Gold-family **text** on light | 5.2:1 |
| `leaf` | `#1f6b45` | Success, complete, QA clean | 5.7:1; white on it 6.5:1 |
| `danger` | `#a32b2d` | Blocked, failed, late | 6.9:1 on `card` |
| `sky` | `#2f638d` | Informational, reference, BIR Center | 5.6:1 |
| `dusk` | `#675885` | Unresolved, exception, unknown | 5.5:1 |
| `earth` | `#5e5446` | Secondary text | 6.5:1 on `paper` |
| `rule` | `#d9ccb0` | Decorative dividers **only** (1.4:1) | Not for control borders |

Rules:

- `antRed` as text only at ≥ 24px bold. Smaller red text uses `antRedText`.
- `honey` is never text on light grounds. Use `honeyText`.
- Interactive borders use `ink` (≥ 3:1). `rule` is decoration only.
- Max one `antRed` fill area per viewport besides the Now button.
- Status pairs: Blocked = `danger` + slashed-circle icon; At risk = `honeyText` + clock; Exception/Unknown = `dusk` + flag/question; Done = `leaf` + check.
- RAG chips always carry the word ("Red", "Amber", "Green", "No RAG").

### 2.2 Typography

| Role | Face | Size / weight / line-height |
|---|---|---|
| Display XL (screen hero, rank-up) | Fraunces | 34 / 800 / 1.05 |
| Display L (screen title) | Fraunces | 26 / 800 / 1.1 |
| Display M (card title, band) | Fraunces | 20 / 700 / 1.15 |
| Title (row primary) | Inter | 16 / 700 / 1.25 |
| Body | Inter | 15 / 400 / 1.45 |
| Body small | Inter | 13 / 500 / 1.4 |
| Label / chip | Inter | 12 / 700 / 1.2 |
| Eyebrow | Inter | 11 / 700 / 1.2, uppercase, +0.08em |
| Numbers (XP, Ants, counts, dates) | Inter, `tabular-nums` | Size of role, 800 for stats |

- Fraunces is for **game and identity** moments (titles, band, ranks, boards). Control facts stay in Inter.
- Minimum text 12px. 11px only for eyebrows.
- Never all-caps a sentence. Never letter-space body text.
- Load from Google Fonts with `display=swap`. The system stack is the fallback.

### 2.3 Spacing, shape, depth

- **Base unit 4px.** Scale: 4, 8, 12, 16, 20, 24, 32, 40.
- **Screen gutter 16px.** Card padding 16px. Gap between cards 16px; inside lists 0 (ruled rows).
- **Borders:** control frames 2px `ink`. **Stamp frame** = 2px outer + 3px gap + 1px inner, for hero and title cards only (max one per screen).
- **Radius:** cards 4px (stamp-like, almost square); sheets 18px top corners; pills 999px; avatars and coins circles.
- **Depth:** a hard offset shadow `3px 3px 0 ink` on pressable cards and podium blocks. No blurred drop shadows. No gradients or glass.
- **Touch targets** ≥ 44×44px. Primary buttons 52px tall.

### 2.4 Motion

| Token | Value | Use |
|---|---|---|
| `tap` | 90ms ease-out, scale 0.97 + shadow collapse | Pressable cards and buttons |
| `sheet` | 280ms `cubic-bezier(.32,.72,0,1)` | Bottom sheets |
| `count` | 600ms | XP/Ant number roll-up |
| `celebrate` | ≤ 1200ms | Rank-up, season podium |

- `prefers-reduced-motion`: no scale, roll-up or confetti. Values appear instantly and a text toast confirms.
- Animation never carries information that isn't also in text.
- Celebrations are interruptible and never block the next action.

---

## 3. Layout and navigation

- **Base viewport 390×844.** Must work from 360 to 430 wide without horizontal scroll. Respect safe-area insets.
- **Structure, top to bottom:** Header (ant frame, sync, greeting) → Band (one-line situation + urgent pill) → Ant trail divider → scrolling content → bottom tab bar.
- **Bottom tab bar (5 slots):** Control Tower · Work · **Now** (raised centre) · Colony · Clients.
  - BIR Center, Team and Admin live in the **profile sheet** (tap your avatar). This follows L-059: mobile prioritizes monitoring, intervention, review and safe actions.
  - Active tab = inverted (`paper` on `ink` bar) **plus** `aria-current="page"`. Not color only.
- **Now button:** 72px `antRed` circle, ant glyph + "Now", count badge. It opens the single next safe action for the user.
- **Sheets, not pages, for single records.** A detail sheet owns one record and one action; it closes on swipe-down, ✕ and Escape, and returns focus to its trigger.
- **One focal point per screen.** The stamp frame or the Now card. Never both competing.

---

## 4. Components (granular rules)

### 4.1 Header
- `ink` (Control screens) or `soil` (Colony screens) background, 96px tall.
- Centre: ant mark in a stamp frame (46px inner). Left: sync dot + "Synced HH:MM" (the dot is backed by text). Right: date + "Hi, {first name}".
- If sync is stale for more than 5 minutes: the dot turns to a `honey` ring and the text reads "Last synced HH:MM". Over 30 minutes, a band warning.

### 4.2 Band
- One sentence + one pill. Example: "3 need you this week" · `[2 urgent]`.
- The pill is `antRed` only when there is something urgent; otherwise `leaf` "All clear".

### 4.3 Ant trail divider
- Dotted red wavy line, 12px, decorative, `aria-hidden`. On Colony screens the dots can "march" once on load (reduced motion: static).

### 4.4 Stamp card (hero)
- Stamp frame, Fraunces Display M/L title, optional eyebrow, optional progress ring on the right.
- Max one per screen.

### 4.5 Work card (Control layer)
- Whole card is one button. Anatomy, in order: client name (Title) + category chip → obligation · stage → status line (icon + words, status color) → RAG chip + deadline phrase → owner avatar on the right.
- **No checkbox.** Tapping opens the detail sheet. Work is never completed from the card.
- Updated state: a `leaf` "Updated just now" line for 10 seconds, then it persists in history.

### 4.6 Status label
- Always icon + text. Icons are 14px stroke, 2.4 weight. Text is 12/700 in the status color.
- Never abbreviate a status ("Blkd"). If it can't fit, wrap.

### 4.7 Scope segmented control
- 3 equal segments, 44px, 2px `ink` borders: **Mine · My clients · All A&T**. Selected = `ink` fill + `aria-pressed="true"`.

### 4.8 Day strip
- 5 weekday cells, 76px tall, 6px bottom bar. Today's bar is `antRed`, the selected cell is `ink`-filled. The count text ("3 due") is required, not just a dot.

### 4.9 Detail sheet
- `paper` background, 4px `antRed` top edge, 18px radius, max 86% height.
- Order: sample/illustrative tag (when applicable) → title → status block → stage stepper (vertical, with words "Done / Current") → facts list (Deadline, Filed, Paid, Owner as **separate rows**) → result/confirmation → primary action + explanation → "View history (who did what)".
- A disabled primary action must explain why, directly below it (e.g. the SoD reason).

### 4.10 XP bar (Game layer)
- 10px tall, `honey` fill on `card` with a 2px `ink` border, rank insignia on the left, "XP to next rank" text on the right.
- Demerits show in the player's own history in `danger` with the reason and, where applicable, "Waived — blocker logged". Never on public boards.

### 4.11 Ant coin
- Circle with a `honey` fill, `ink` border and an ant glyph. Number in Inter 800 tabular.
- Balances always show available and held separately when anything is held ("1,240 Ants · 500 on hold").

### 4.12 Rank insignia
- A shield/badge shape per tier with the tier number inside, so the rank reads without color. Tiers 1–2 outline, 3–5 `honey` fill, 6–8 `soil` with `honey` trim.
- Names are always shown next to the insignia on profile and rank-up surfaces.

| Tier | Name | Glyph idea |
|---|---|---|
| 1 | Larva | Small curled ant |
| 2 | Worker Ant | Ant carrying a leaf |
| 3 | Forager | Ant with a seed |
| 4 | Tunneler | Ant + tunnel arc |
| 5 | Soldier Ant | Ant + shield |
| 6 | Scout Captain | Ant + flag |
| 7 | Colony Elder | Ant + laurel |
| 8 | Colony Keeper | Ant + crown-free star |

### 4.13 Leaderboard
- **Tabs:** Live (this cycle) · Colony Cup (quarter) · Hall (all-time).
- **Podium** for places 1–3: offset-shadow blocks of different heights, with avatar, name, XP and the place number (1/2/3) printed on the block, not just gold/silver/bronze color.
- **Rows** 4–10: position · avatar · name + rank insignia · XP (right, tabular) · clean rate % under the XP.
- **Your row** is pinned at the bottom if you're outside the top 10, highlighted with an `ink` border and a "You" label.
- Each board shows its window under the title ("This cycle", "Q4 Colony Cup", "All-time") and role tabs: Overall · Forager · Sentinel · Elder · Steward.
- Position changes show ▲/▼ with a number, never color alone.
- **No bottom-ranked list, no "last place" label, anywhere.**

### 4.14 Celebration and toasts
- **XP toast:** bottom, above the tab bar, 3 seconds, "+40 XP · filed and accepted". Tap to see the source work.
- **Rank-up:** full-screen moment with the new insignia, Display XL name and a short Taglish line. Dismissible.
- **Season podium:** shown once when a season is finalized.
- Never celebrate: submission, a pending result, an override, or anything later reversed.

### 4.15 Buttons
- **Primary:** `antRed` fill, white 16/700 label, 52px tall, full width in sheets. One per sheet.
- **Secondary:** `card` fill, 2px `ink` border, `ink` label.
- **Quiet:** text-only `ink`, underline on focus/hover.
- **Disabled:** `#e5e1d6` fill, `earth` label, with a reason line below.
- Labels are verbs that say what happens: "Record client approval", not "Submit".

### 4.16 Inputs
- 48px, 2px `ink` border, `card` fill, visible label above. Errors in `danger` with an icon and text below the field.

### 4.17 Empty, loading, error
- **Empty (Game):** the ant illustrates it ("Wala pang XP this cycle — your first clean filing starts the climb").
- **Empty (Control):** a plain reason + the safe next action.
- **Loading:** skeletons in the final layout. No spinners over content.
- **Error:** what failed + "Try again". Game errors never hide control data. If Colony is down, Control screens still work and the Colony tab says "Scores are catching up".

---

## 5. Accessibility contract

- WCAG 2.2 AA. Text 4.5:1, large text and UI boundaries 3:1. Tokens above comply when used as specified.
- Every icon-only control has an accessible name. Decorative SVG is `aria-hidden`.
- Real `button`, `a` and `input` elements. Sheets are `role="dialog"` with focus trap, Escape and focus return.
- Live regions (`aria-live="polite"`) announce XP awards and saved actions.
- Dynamic type: layouts survive 130% text size without truncating statuses.
- Reduced motion fully respected (§2.4). Sounds are off by default.
- Leaderboard is a list with position announced ("Position 4, Ana, 1,320 XP, clean rate 96%").

---

## 6. Sample-data and content rules

- Mockups and previews use fictional clients marked "(sample)" and dates marked "sample".
- No Philippine tax content is invented. Unknown deadlines show "Unknown — no approved rule".
- Reward items are configured by Admin. Designs show placeholder labels like "[Reward item]" until the HOD approves the catalog.

---

## 7. Do / Don't

| Do | Don't |
|---|---|
| Celebrate accepted, evidenced, QA-clean outcomes | Celebrate submissions or clicks |
| Show XP **and** clean rate | Rank on volume with no quality signal |
| Pin "You" on the board | Show anyone's bottom position |
| Use Fraunces for game/identity moments | Use Fraunces for deadlines, statuses or evidence |
| Keep one stamp card per screen | Stack framed cards inside framed cards |
| Explain every disabled action | Hide why something can't be done |
| Use Taglish warmly in the game voice | Use humor in control facts or errors |
