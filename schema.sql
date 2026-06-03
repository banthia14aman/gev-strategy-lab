-- ─── GE Vernova Strategy Lab — Supabase Schema ──────────────────────────────
-- Run this entire script once in the Supabase SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Game state (single row, controls round progression)
CREATE TABLE IF NOT EXISTS game_state (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  status        TEXT    DEFAULT 'lobby',
  current_round INTEGER DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#4DA8FF',
  total_revenue INTEGER DEFAULT 0,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  last_active   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Round submissions (one row per team per round)
CREATE TABLE IF NOT EXISTS team_rounds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID REFERENCES teams(id) ON DELETE CASCADE,
  round_number     INTEGER NOT NULL,
  power            INTEGER DEFAULT 0,
  wind             INTEGER DEFAULT 0,
  electrification  INTEGER DEFAULT 0,
  strategy         TEXT    DEFAULT 'balanced',
  revenue          INTEGER DEFAULT 0,
  submitted        BOOLEAN DEFAULT FALSE,
  submitted_at     TIMESTAMPTZ,
  entered_manually BOOLEAN DEFAULT FALSE,
  UNIQUE(team_id, round_number)
);

-- 4. Seed the game_state row (idempotent)
INSERT INTO game_state (id, status, current_round)
VALUES (1, 'lobby', 0)
ON CONFLICT (id) DO NOTHING;

-- 5. Disable RLS for simplicity (re-enable + add policies for production)
ALTER TABLE game_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams      DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_rounds DISABLE ROW LEVEL SECURITY;

-- 6. Enable Realtime on all three tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rounds;
