# 10 — Game Mechanics Study: Why Mainstream Games Hook, and What Colony Should Take

Status: **RESEARCH NOTE — input to `08-COLONY-GAME-PROPOSAL.md`.** Nothing here
is approved. Section 6 lists the candidate features for HOD decision.

Sources: general knowledge of widely played games (MOBAs such as
Mobile Legends: Bang Bang, battle royales such as PUBG Mobile, plus
Clash of Clans, Genshin Impact and Duolingo as reference points), and standard
motivation research (self-determination theory, reinforcement schedules).
Game-specific details change every season. Treat named examples as
illustrations of a mechanic, not current facts about any game.

---

## 1. The short answer

Mainstream mobile games hook because they stack **three loops of different
lengths** and make progress visible in all of them:

| Loop | Length | Example (MOBA / battle royale) | Feeling |
|---|---|---|---|
| **Core loop** | 10–25 minutes | One match: play → win or lose → stars, medal, rewards | "One more game" |
| **Meta loop** | Days to weeks | Daily/weekly missions, hero unlocks, pass tiers, rank climb | "I'm getting somewhere" |
| **Season loop** | 1–3 months | New season, soft rank reset, new pass, new cosmetics | "Fresh start, new chance" |

They stay **flexible and scalable** because the core loop is fixed code and
almost everything else is **content defined as data**: seasons, missions,
passes, events, cosmetics and rank tables change without rebuilding the game.

---

## 2. Why it hooks: the psychology

| Driver | What it means | How games trigger it |
|---|---|---|
| **Competence** | Feeling good at something | Ranks, medals (MVP), visible skill growth |
| **Autonomy** | Choosing your own path | Pick your hero/role, pick missions, choose cosmetics |
| **Relatedness** | Belonging | Squads, clans, friends lists, team wins |
| **Clear goals + instant feedback** | Always know the next target | XP bars, "2 stars to Epic", mission checklists |
| **Variable rewards** | Unpredictable payoffs are the most compelling | Random drops, chests, gacha. *The most powerful and the most abusable* |
| **Loss aversion** | Losing hurts more than winning feels good | Losing stars, breaking streaks, rank demotion |
| **Status and social proof** | Being seen | Rank badges, titles, frames, kill feed, leaderboards |
| **Near-miss** | "Almost" drives retry | Losing by one star or one kill |
| **Collection** | Completing sets | Hero rosters, skin collections, achievement albums |
| **Scarcity / FOMO** | Fear of missing out | Limited-time events and skins |
| **Identity** | "This is who I am in the game" | Main role, signature hero, custom skins |

Healthy designs lean on **competence, autonomy, relatedness, clear goals and
status**. Exploitative designs lean on **variable rewards with money, loss
aversion and FOMO**. Colony must sit firmly in the first group, because
it's a workplace tool and real-value rewards are involved.

---

## 3. Mechanics breakdown

Verdict key: **Take** = use close to as-is · **Adapt** = change for work · **Avoid**.

| # | Mechanic | How games do it | Why it works | Colony translation | Verdict |
|---|---|---|---|---|---|
| 1 | **Short matches** | 10–25 min self-contained rounds | Fits any break; clear end | **A "match" = one work item to its next verified step.** The Now button starts a match | Take |
| 2 | **Ranked tiers + stars** | Named tiers (e.g. Warrior → Mythic; Bronze → Conqueror), stars within tiers | Granular progress; prestige names | Ant colony ranks (Larva → Colony Keeper) per **season**, with stars inside each rank | Take |
| 3 | **Rank protection** | Protection cards / points stop a loss from costing a star | Softens loss aversion, keeps people playing | **Streak freeze** for leave/sick days; protection earned by QA-clean work | Adapt |
| 4 | **Soft seasonal reset** | Rank drops a few tiers each new season | Fresh competition; newcomers can catch up | Season rank resets partially; **lifetime rank and Hall never reset** | Take |
| 5 | **Roles / classes** | Tank, Marksman, Mage, Support… each valued | Everyone can be great at something | **Role classes:** Forager (preparer), Sentinel (checker), Elder (reviewer). **Separate role boards** so checkers aren't ranked against preparers' volume | Take |
| 6 | **Matchmaking / brackets** | Matched by skill rating | Fair fights at any scale | **Brackets by role and client-load band** as the team grows | Adapt |
| 7 | **Per-match medals** | MVP, Gold/Silver medals, rare streak callouts | Recognition even in a loss | **Cycle MVP** per role, plus rare medals: "Perfect Cycle" (all first-pass, on time, QA clean), "Blocker Buster" | Take |
| 8 | **Daily / weekly missions** | Rotating checklist with rewards | A reason to return; variety | **Forage Missions:** pick 3 of 5 weekly, all based on verified facts (e.g. "2 filings accepted before package target") | Adapt |
| 9 | **Season / battle pass** | Free + paid reward track over a season | Long goal with steady drip of rewards | **Colony Pass:** free for everyone, no paid track. Tiers unlock cosmetics, titles and Ant bonuses within committee budget | Adapt |
| 10 | **Limited-time events** | Event modes, double-XP weekends | Novelty and spikes of engagement | **Rush Events** during configured peak periods: a temporary XP multiplier, **capped by budget**, announced in advance | Adapt |
| 11 | **Cosmetics / skins** | Hero skins, frames, emotes; no power | Status and identity at near-zero cost | **Ant skins, profile frames, titles** ("Deadline Slayer"). The cheapest, most scalable reward, with no peso cost | Take |
| 12 | **Collections / codex** | Hero roster, achievements album | Completionism | **Badge Album** with silhouettes for not-yet-earned badges | Take |
| 13 | **Clans / squads** | Groups with shared goals and chat | Belonging and peer accountability | **Later**, using existing org units when you add clusters. Not in the first build | Defer |
| 14 | **Raid boss / co-op goal** | Whole guild fights one boss | Shared purpose, no losers | **"Anay" the termite boss** (§5). Its HP = the colony's open items; the cycle's Race to All Clear is the raid | Take |
| 15 | **Kill feed / announcements** | "X got a Savage!" broadcast | Social proof; status moments | **Colony Feed** of achievements only (never failures). Each person can opt out of appearing | Adapt |
| 16 | **Comeback / catch-up** | Bonus for returning or new players | Keeps late joiners motivated | **Welcome-back boost** after leave; **rookie bracket** for the first season | Take |
| 17 | **Login rewards** | Reward just for opening the app | Habit forming | Breaks "every click must advance work." Reward real actions only | Avoid |
| 18 | **Energy / stamina limits** | Play limited by a recharging resource | Paces players, drives spending | Pressure with no work value | Avoid |
| 19 | **Gacha / loot boxes** | Paid random draws | Very strong variable reward | **Gambling-like with real-value rewards.** Random drops, if any, are cosmetic only | Avoid |
| 20 | **Demotion / public losses** | Losing ranks, visible defeats | Raises stakes | Publicly shaming staff. Promotion-only leagues; no bottom lists | Avoid |
| 21 | **Behaviour / credibility score** | Score drops for toxic play | Keeps matches healthy | A conduct score on staff is an HR instrument, and RAG must never be a personal score | Avoid |
| 22 | **Pay-to-win** | Spending buys power | Revenue | Not applicable, and must never appear (e.g. buying XP with Ants) | Avoid |

---

## 4. How they stay flexible and scalable

### 4.1 Fixed core, data-driven everything else ("live ops")

Games separate:

- **The engine (rarely changes):** match rules, scoring and anti-cheat.
- **Content (changes every week):** events, missions, passes, skins, rank tables and seasons. Stored as data and switched on by date.

That's why a game can run a new event every week for millions of players
without an app update.

**Colony mirrors this:**

| Engine (code, reviewed, tested) | Content (configuration rows, effective-dated, approved) |
|---|---|
| Facts → award projector (`08` §7) | Seasons, rank tiers, award XP values |
| Fixed list of **metric types** (e.g. `filed_accepted_on_time`, `qa_clean`, `first_pass`) | Missions = metric type + target count + window + reward |
| Ledger, settlement, clawback | Rush Events = window + multiplier + cap |
| Leaderboard computation | Pass tiers, cosmetics, titles, badges |
| Guardrails (`08` §6) | Reward catalog (committee) |

**Important:** missions and events are a **parameterized catalog over a fixed
set of metric types**, not a rules language. Adding a new *kind* of
achievement means adding a reviewed metric type in code. Adding a new mission
or event is just a row. That keeps it inside the AGENTS.md ban on rules DSLs
while staying flexible.

### 4.2 Scaling dimensions

| Grows | How games handle it | Colony plan |
|---|---|---|
| More players | Brackets, leagues, regional boards | Role boards → load-band brackets → office leagues |
| More teams | Clans and clan wars | Team mode on existing `organization_units` when clustering is approved |
| More content | Content calendar, seasonal themes | Season themes ("Tag-ulan Season", "Year-end Rush") set by config |
| More reward types | Item catalogs with rarity | Cosmetic catalog (free to scale) + committee catalog (budgeted) |
| More work types | New modes on the same engine | New metric types when TaxMonWeb produces new verified facts |
| More load | Precomputed leaderboards, caching | Derived views first; snapshot tables at season close; no new infrastructure |

### 4.3 Economy balancing

Games tune their economy constantly with telemetry. Colony's equivalent:

- **Shadow mode** (`08` Lego G1) to see XP distributions before launch.
- **Two currencies.** XP can't be spent, so it can inflate freely. Ants are tied to pesos, so they're capped by the committee budget.
- **Cosmetics carry most of the reward load.** Real-value prizes stay the rare top of the pyramid. This is how games give constant rewards cheaply.

---

## 5. Making it enjoyable: the Colony feel

- **A character, not a scoreboard.** Gamgam (working name) reacts to what you do: cheers on verified wins, goes quiet and calm around real deadlines, is cheeky in empty states.
- **A villain to beat together.** **Anay**, a fictional termite that eats the colony's foundations, stands for late penalties and unfinished work. Each filing cycle, Anay's HP bar equals the colony's open items. Every verified completion is a hit. Clearing everything is **All Clear**: Anay is defeated, everyone gets a shared reward, and the podium shows the top hitters. Competitive individuals, cooperative team, no losers. It also keeps the original "Race to All Clear" idea alive.
- **Variety:** rotating missions, seasonal themes, occasional Rush Events.
- **Mastery:** role-specific ranks and medals, so everyone has a path to be the best at something.
- **Respect for time:** sessions are real work. The game never asks for extra minutes.
- **Humor with a line:** the game voice can joke; compliance facts never do (`09` §1.2).

---

## 6. Candidate features for HOD decision

| # | Feature | Mechanic source | Recommendation | Build after |
|---|---|---|---|---|
| A | Role classes + role leaderboards | Roles | **Yes**, core to fairness | G2 |
| B | Anay raid boss (cycle co-op goal) | Raid boss | **Yes**, signature feature | G2 |
| C | Cycle MVP + rare medals | Medals | **Yes** | G3 |
| D | Seasonal ranks with stars + soft reset | Ranked tiers | **Yes** | G3 |
| E | Streak freeze | Rank protection | **Yes** | G3 |
| F | Forage Missions (pick 3 of 5) | Missions | **Yes** | G4 |
| G | Badge Album | Collection | **Yes** | G4 |
| H | Cosmetics: ant skins, frames, titles | Skins | **Yes**, the cheapest reward lever | G4 |
| I | Colony Pass (free track) | Battle pass | **Yes**, after cosmetics exist | G5 |
| J | Rush Events (budget-capped) | Events | **Yes**, with advance notice | G5 |
| K | Colony Feed (achievements only, opt-out) | Kill feed | Optional | G4 |
| L | Welcome-back boost, rookie bracket | Comeback | **Yes** | G3 |
| M | Squads / clan wars | Clans | **Later**, needs clustering | — |
| — | Login rewards, energy, gacha, demotion, conduct score, pay-to-win | — | **No** | — |

---

## 7. Beyond RPGs: apps that make real-life work feel like a game

Same caution as above: general knowledge, illustrative, not current product facts.

| App | Category | The one idea worth stealing | Colony translation |
|---|---|---|---|
| **Habitica** | Habit tracker as RPG | Your real to-dos *are* the game: completing tasks damages a boss your party fights together | Closest analog to Colony. Validates **Anay**: real work items deal the damage |
| **Finch** | Self-care pet | A pet that grows because *you* took care of yourself; gentle, never guilt-trips | **Gamgam grows and gains outfits** with the colony's clean work; kind tone by default |
| **Forest** | Focus timer | A tree grows while you focus; your forest is a visible history of effort | The **Anthill**: chambers get dug as cycles are completed clean; your history is something you can look at |
| **GCash GForest** | Fintech habit (PH) | Small everyday actions earn energy that plants real trees | Local proof that Filipinos love "small actions → visible, real-world result". The committee's real prizes play the same role |
| **Pokémon GO / Pikmin Bloom** | Real-world play | Everyday movement becomes collection and discovery | **Collect** badges and ant skins through normal work, no extra effort |
| **Strava** | Fitness social | Segments (local leaderboards), kudos, clubs | **Micro-leaderboards** per client or form type; **kudos** between colleagues (free, positive only) |
| **Apple Fitness rings** | Daily goals | Three simple rings to "close" each day; trivial to understand | **Three cycle rings**: Filed on time · Evidence complete · QA clean. Close all three = Perfect Cycle |
| **GitHub contribution graph** | Developer habit | A calendar heat map of activity; people protect their streak | **Colony calendar** of verified work days (private to you) |
| **Duolingo** | Learning | Mascot personality, streaks, leagues, celebrations | Already adopted: Gamgam voice, streak freeze, promotion-only leagues, Sassy mode |
| **Salesforce Trailhead** | Workplace learning | Ranks + badges for real skills; adults happily collect them at work | **Skill badges** for mastering return types or tools; proof that serious professionals engage with badges |
| **Sales leaderboards / live TV boards** | Workplace competition | Live boards on a screen in the office; short "contests" | **Tower TV mode**: the live board and Anay's HP on an office screen during peak cycles |
| **Starbucks / Grab rewards** | Loyalty | Stars → tiers → redemption; the wallet always shows "X to your next reward" | **Ant wallet** shows the next reward within reach |
| **Clash of Clans** | Base-building | A home base you upgrade and show off; clan wars | The **Anthill is the home screen**: your colony's base, upgraded by clean cycles |

### 7.1 What this changes

The strongest pattern across these apps is **a living thing that grows because
of what you actually did**: Forest's trees, Finch's bird, GForest's real trees,
Clash's village. That suggests one new idea for Colony:

**The Anthill as home base.** On mobile, the first screen is a living anthill
cross-section, not a dashboard:

- **Chambers are dug** as cycles finish clean (history you can see).
- **Ant workers move** in proportion to work in progress.
- **Anay's tunnels** creep in from the edge as items go overdue, and are pushed back as they're cleared.
- **Gamgam** stands at the entrance with today's line ("3 need you today. Kaya natin 'to.").
- **Tap anywhere real**: a tunnel opens the overdue items, a chamber opens that cycle's record. Every visual is backed by an operational record (one truth, no decorative fiction).

The control facts don't disappear. They're one tap away and exact. But the
emotional first impression is "our colony", not "my task list".

### 7.2 Guardrail for "game more than ERP"

Colony should feel like a game **whose moves are real compliance work**. The
game can never invent progress, hide a real deadline or status, or make a
control step skippable. The Anthill can be playful precisely because every
pixel of it is derived from verified facts.
