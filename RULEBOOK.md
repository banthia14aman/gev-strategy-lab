# GE Vernova Strategy Lab — Rule Book

A fast, four-round portfolio simulation. Each team plays the role of a GE Vernova
executive committee, allocating capital across the company's three business
segments under changing market conditions. The team with the **highest cumulative
revenue** after four rounds wins.

---

## 1. The objective

Maximise your **cumulative revenue** across four market rounds by allocating your
budget wisely between **Power**, **Wind**, and **Electrification** and choosing a
**strategic posture** that fits each market event.

---

## 2. The three segments

| Segment | What it represents | Base score (per point) |
|---|---|---|
| **Power** | Gas turbines, nuclear services, hydro — reliable baseload, strong backlog | **120** |
| **Wind** | Onshore & offshore wind — higher upside, more execution / supply-chain risk | **85** |
| **Electrification** | Grid modernisation, power conversion, high-voltage equipment — structural growth | **110** |

The base score is the revenue weight of putting one allocation point into that
segment, **before** market events and strategy are applied.

---

## 3. How much you allocate — per round

**Every round, each team allocates exactly 100 points** across the three segments.

- The allocation sliders **auto-balance** so the three values always sum to **100**.
- It is a **fresh 100 points every round** — points are *not* a shared pool that
  depletes over the game. You re-decide your full 100-point split each round.
- Over the full game a team makes **four independent 100-point allocations**
  (Round 1, Round 2, Round 3, Round 4).

> **In short:** 100 points per round × 4 rounds. Each round's split is independent.

---

## 4. Strategic posture

In addition to the allocation, each round you pick **one posture**. It modifies your
whole round result depending on whether the market event is positive or negative.

| Posture | On a **positive** event | On a **negative** event | Best for |
|---|---|---|---|
| **Aggressive** | ×1.15 (chase the upside) | ×0.90 (bigger losses) | Teams chasing first place |
| **Balanced** | ×1.00 | ×1.00 | A safe, consistent default |
| **Resilient** | ×0.92 (capped upside) | ×1.10 (protected downside) | Teams protecting their rank |

---

## 5. The four rounds (market events)

Each round reveals one market event that multiplies each segment's value.

| Round | Event | Direction | Power | Wind | Electrification |
|---|---|---|---:|---:|---:|
| **1** | AI Data Center Demand Surge | Positive | **+25%** | 0% | **+10%** |
| **2** | Offshore Wind Execution Delay | Negative | +10% | **−25%** | 0% |
| **3** | Grid Modernization Policy Push | Positive | 0% | +10% | **+30%** |
| **4** | Global Macro Shock | Negative | −10% | −15% | −5% |

The **tiebreaker** is the **highest Round 4 (crisis round) score**.

---

## 6. Scoring formula

For each round:

```
Round Revenue = Σ_segment ( allocation_points × base_score × event_multiplier )
                × strategy_multiplier
```

where `strategy_multiplier` is the posture's positive or negative value depending
on the round's event direction.

`allocation_points` is on a 0–100 scale (your slider value). Putting all 100 points
into one segment uses the full base score for that segment.

### Worked example — Round 1 (AI Demand Surge, positive)

A team allocates **Power 50 / Wind 20 / Electrification 30** with the **Aggressive** posture.

```
Power            : 50 × 120 × 1.25 = 7,500
Wind             : 20 ×  85 × 1.00 = 1,700
Electrification  : 30 × 110 × 1.10 = 3,630
                                    ───────
Subtotal                            12,830
Aggressive (positive event ×1.15) = 14,754  ← Round 1 Revenue
```

A **Balanced** team with the same split would score **12,830**; a **Resilient**
team would score 12,830 × 0.92 = **11,804**. Aggressive wins on a positive event —
but the same posture loses ground on the negative rounds (2 and 4).

### Cumulative revenue

```
Total Revenue = Round 1 + Round 2 + Round 3 + Round 4 revenues
```

Your **Total** is simply the sum of every round you submitted. The leaderboard ranks
teams by Total, descending.

---

## 7. Joining mid-round (late joiners)

You can join at any time — including after the game has started.

- A team that joins mid-game **immediately gets the active round screen** and can
  allocate its full **100 points** for the **current round** and every round after.
- A late joiner earns **0 for any round that already finished** before they joined.
  Those rounds appear as **"—"** on their scorecard and contribute nothing to their
  Total.
- There is **no catch-up bonus** — a team that joins in Round 3 competes on Rounds 3
  and 4 only, starting from a Total of 0.

> **In short:** mid-round joiners still allocate a full 100 points for the current
> and remaining rounds, but score nothing for rounds they missed.

---

## 8. Round flow (what each round looks like)

1. The facilitator starts the round — every team's screen flips to the round view.
2. The market event is revealed with its per-segment impacts.
3. A **2-minute timer** counts down (synced across all teams).
4. Each team sets its **100-point allocation** and **posture**, then **Submits**.
   - You can re-open and re-submit until the facilitator reveals results — the latest
     submission is the one that counts (no double-counting).
5. The facilitator **reveals results** — every team sees its round breakdown and the
   live leaderboard. (The facilitator can reveal early once all teams are in.)
6. Repeat for Rounds 2–4, then the **Final Results** screen shows the winner.

---

## 9. Quick reference

- **Teams:** up to 10
- **Rounds:** 4
- **Allocation:** 100 points per team per round (auto-balanced)
- **Round timer:** 2 minutes
- **Postures:** Aggressive / Balanced / Resilient
- **Winner:** highest cumulative revenue; tiebreak = highest Round 4 score
- **Admin PIN:** `GEV2025` (change in `admin.js` before a real session)
