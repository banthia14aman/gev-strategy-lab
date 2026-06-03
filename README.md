# GE Vernova Strategy Lab

A 10-minute portfolio allocation simulation for up to 10 teams, built on Supabase (real-time) + GitHub Pages (hosting).

## Setup (one-time, ~5 minutes)

### 1. Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name: `gev-strategy-lab` · Region: closest to you · Set a database password
3. Wait ~2 min for provisioning

### 2. Run the schema
1. In your project → **SQL Editor** → **New query**
2. Paste the contents of `schema.sql` → **Run**

### 3. Add credentials to config.js
In **Project Settings → API** copy:
- **Project URL** → `SUPABASE_URL`
- **anon / public** key → `SUPABASE_ANON_KEY`

Edit `config.js`:
```js
window.SUPABASE_URL      = 'https://xxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJ...';
```

### 4. Commit and push
```bash
git add config.js
git commit -m "Add Supabase credentials"
git push
```
GitHub Pages will automatically redeploy in ~60 seconds.

## Running the game

| Role | URL |
|---|---|
| Teams (×10) | `https://banthia14aman.github.io/gev-strategy-lab/` |
| Facilitator  | `https://banthia14aman.github.io/gev-strategy-lab/admin.html` |

**Admin PIN:** `GEV2025`

### Game flow
1. Facilitator opens `admin.html`, enters PIN
2. Share the team link — teams open it, set their team name, and wait in the lobby
3. Facilitator clicks **▶ Start Game (Round 1)**
4. Teams see the event card, move sliders (must total 100), pick a strategy, and submit
5. Facilitator clicks **📊 Reveal Round Results** — leaderboard appears on all screens
6. Repeat for rounds 2–4, then **🏁 Show Final Results**

### Admin PIN
Change `ADMIN_PIN` at the top of `admin.js` before your session.

## Scoring

```
Round Revenue = Σ(Allocation_s / 100 × BaseScore_s × EventMultiplier_s) × 100 × StrategyMultiplier
```

| Segment | Base Score |
|---|---|
| Power | 120 |
| Wind | 85 |
| Electrification | 110 |

| Strategy | Positive event | Negative event |
|---|---|---|
| Aggressive | ×1.15 | ×0.90 |
| Balanced | ×1.00 | ×1.00 |
| Resilient | ×0.92 | ×1.10 |

## Tiebreaker
Highest score in the crisis round (Round 4).
