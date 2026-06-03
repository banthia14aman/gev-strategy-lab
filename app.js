/* GE Vernova Strategy Lab — Team Game Logic (Supabase) */

'use strict';

let SIM = null;
let sb  = null;
let realtimeChannel = null;
let pollingInterval = null;

// ─── Team state ───────────────────────────────────────────────
const state = {
  teamId:           null,
  teamName:         null,
  teamColor:        null,
  currentRound:     0,
  gameStatus:       'lobby',
  selectedStrategy: 'balanced',
  hasSubmitted:     false,
  timerInterval:    null,
  timerRemaining:   120,
};

const TEAM_COLORS = [
  '#4DA8FF','#78BE20','#F4A024','#FF6B9D','#A78BFA',
  '#34D399','#FB923C','#60A5FA','#F472B6','#FACC15',
];

// ─── Scoring engine ───────────────────────────────────────────
function calculateRoundRevenue(power, wind, electrification, strategy, roundIndex) {
  const event    = SIM.events[roundIndex];
  const strat    = SIM.strategies[strategy];
  const segments = SIM.segments;

  const base =
    (power           / 100) * segments.power.baseScore           * event.multipliers.power +
    (wind            / 100) * segments.wind.baseScore            * event.multipliers.wind +
    (electrification / 100) * segments.electrification.baseScore * event.multipliers.electrification;

  const mult = event.direction === 'positive'
    ? strat.positiveMultiplier
    : strat.negativeMultiplier;

  return Math.round(base * 100 * mult);
}

function getSegmentRevenue(allocation, segment, roundIndex) {
  const event = SIM.events[roundIndex];
  return Math.round((allocation / 100) * SIM.segments[segment].baseScore * event.multipliers[segment] * 100);
}

// ─── UI helpers ───────────────────────────────────────────────
const show = id => document.getElementById(id)?.classList.remove('hidden');
const hide = id => document.getElementById(id)?.classList.add('hidden');
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

function setScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
}

function showToast(msg, type = 'info', duration = 3500) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.cssText = 'opacity:0;transform:translateY(8px);transition:0.3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function updateHeaderStatus(status) {
  const pill = document.getElementById('header-status');
  const text = document.getElementById('header-status-text');
  if (!pill || !text) return;
  const cls  = { lobby:'lobby', final:'final' };
  const label = { lobby:'Lobby', final:'Final' };
  const m = status.match(/^(round|results)(\d)$/);
  pill.className = `status-pill ${m ? (status.startsWith('round') ? 'active' : 'results') : (cls[status]||'lobby')}`;
  text.textContent = m
    ? (status.startsWith('round') ? `Round ${m[2]} Active` : `Round ${m[2]} Results`)
    : (label[status] || 'Lobby');
}

// ─── Timer ────────────────────────────────────────────────────
function formatTime(sec) {
  return `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
}

function startLocalTimer(durationSec) {
  clearInterval(state.timerInterval);
  state.timerRemaining = durationSec;
  const el = document.getElementById('timer-display');
  const tick = () => {
    if (!el) return;
    el.textContent = formatTime(state.timerRemaining);
    el.className = 'timer-display';
    if (state.timerRemaining <= 30) el.classList.add('warning');
    if (state.timerRemaining <= 10) el.classList.add('urgent');
    if (state.timerRemaining <= 0) { clearInterval(state.timerInterval); el.textContent = '0:00'; }
  };
  tick();
  state.timerInterval = setInterval(() => { state.timerRemaining = Math.max(0, state.timerRemaining-1); tick(); }, 1000);
}

// ─── Sliders ──────────────────────────────────────────────────
function updateSliderBackground(slider) {
  slider.style.setProperty('--val', slider.value + '%');
}

function getSliderValues() {
  return {
    power:           parseInt(document.getElementById('slider-power')?.value || 34, 10),
    wind:            parseInt(document.getElementById('slider-wind')?.value || 33, 10),
    electrification: parseInt(document.getElementById('slider-electrification')?.value || 33, 10),
  };
}

function updateTotalBar() {
  const { power, wind, electrification } = getSliderValues();
  const total = power + wind + electrification;

  setText('val-power',           power.toString());
  setText('val-wind',            wind.toString());
  setText('val-electrification', electrification.toString());

  const fill = document.getElementById('total-bar-fill');
  const num  = document.getElementById('total-bar-num');
  const btn  = document.getElementById('submit-btn');

  if (fill) {
    fill.style.width = Math.min(total, 100) + '%';
    fill.className = `total-bar-fill${total>100?' over':total===100?' exact':''}`;
  }
  if (num) {
    num.textContent = total.toString();
    num.className = `total-bar-number${total>100?' over':total===100?' exact':''}`;
  }
  if (btn) btn.disabled = total !== 100 || state.hasSubmitted;
}

// ─── Strategy buttons ─────────────────────────────────────────
function setupStrategyButtons() {
  document.querySelectorAll('#screen-round .strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#screen-round .strategy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedStrategy = btn.dataset.strategy;
    });
  });
}

// ─── Event card ───────────────────────────────────────────────
function renderEventCard(roundIndex) {
  const event = SIM.events[roundIndex];
  if (!event) return;

  const wrap = document.getElementById('event-card-wrap');
  if (wrap) wrap.className = `event-card ${event.direction}`;

  setText('event-round-num', event.round.toString());
  setText('event-name',      event.name);
  setText('event-desc',      event.description);

  const impacts = document.getElementById('event-impacts');
  if (impacts) {
    impacts.innerHTML = '';
    ['power','wind','electrification'].forEach(seg => {
      const pct  = Math.round((event.multipliers[seg] - 1) * 100);
      const cls  = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
      const sign = pct > 0 ? '+' : '';
      const label = seg.charAt(0).toUpperCase() + seg.slice(1);
      const pill = document.createElement('span');
      pill.className = `impact-pill ${cls}`;
      pill.textContent = `${label}: ${sign}${pct}%`;
      impacts.appendChild(pill);
    });
  }
}

// ─── Lobby ────────────────────────────────────────────────────
function renderLobbyTeams(teams) {
  const list    = document.getElementById('lobby-teams-list');
  const countEl = document.getElementById('teams-count');
  if (!list) return;
  if (countEl) countEl.textContent = teams.length;
  if (teams.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p class="empty-state-text">Teams will appear here as they join</p></div>`;
    return;
  }
  list.innerHTML = '';
  [...teams].sort((a,b)=> new Date(a.joined_at)-new Date(b.joined_at)).forEach(team => {
    const row = document.createElement('div');
    row.className = 'team-row';
    const isYou = team.id === state.teamId;
    row.innerHTML = `
      <div class="team-chip" style="background:${team.color||'#4DA8FF'};"></div>
      <span class="team-row-name">${team.name}${isYou?' <span class="you-badge">You</span>':''}</span>
      <span class="team-row-time">Ready</span>
    `;
    list.appendChild(row);
  });
}

// ─── Round reset ──────────────────────────────────────────────
function resetRoundUI() {
  [['slider-power',34],['slider-wind',33],['slider-electrification',33]].forEach(([id,v]) => {
    const el = document.getElementById(id);
    if (el) { el.value = v; updateSliderBackground(el); }
  });
  document.querySelectorAll('#screen-round .strategy-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('#screen-round .strategy-btn[data-strategy="balanced"]')?.classList.add('selected');
  state.selectedStrategy = 'balanced';
  hide('submitted-banner');
  const btn = document.getElementById('submit-btn');
  if (btn) { btn.disabled = false; btn.classList.remove('hidden'); }
  updateTotalBar();
}

// ─── Results screen ───────────────────────────────────────────
function renderResultsScreen(roundData, roundIndex, team, allTeams) {
  if (!SIM) return;
  const round = roundIndex + 1;
  setText('result-round-num', round.toString());

  const stratBadge = document.getElementById('result-strategy-badge');
  if (stratBadge && roundData?.strategy) {
    stratBadge.textContent = `Strategy: ${roundData.strategy.charAt(0).toUpperCase()+roundData.strategy.slice(1)}`;
  }

  const breakdown = document.getElementById('score-breakdown');
  if (breakdown && roundData) {
    breakdown.innerHTML = '';
    ['power','wind','electrification'].forEach(seg => {
      const alloc = roundData[seg] || 0;
      const segRev = getSegmentRevenue(alloc, seg, roundIndex);
      const pct = Math.round((SIM.events[roundIndex].multipliers[seg] - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      const div = document.createElement('div');
      div.className = 'score-seg';
      div.innerHTML = `
        <div class="score-seg-name ${seg}">${seg.charAt(0).toUpperCase()+seg.slice(1)}</div>
        <div class="score-seg-value">${segRev.toLocaleString()}</div>
        <div class="score-seg-alloc">${alloc}% alloc · event ${sign}${pct}%</div>
      `;
      breakdown.appendChild(div);
    });
  }

  setText('result-round-rev', (roundData?.revenue || 0).toLocaleString());
  setText('result-total-rev', (team?.total_revenue || 0).toLocaleString());

  // Debrief
  const debrief = document.getElementById('results-debrief');
  const debriefText = document.getElementById('results-debrief-text');
  const event = SIM.events[roundIndex];
  if (debrief && debriefText && event?.debrief) {
    debrief.style.display = 'block';
    debrief.className = `event-card ${event.direction}`;
    debriefText.textContent = event.debrief;
  }

  renderLeaderboard(allTeams, 'results-leaderboard-body', round);

  const nextMsg = document.getElementById('next-round-msg');
  if (nextMsg) nextMsg.textContent = round >= 4
    ? 'Waiting for the facilitator to reveal final results…'
    : 'Waiting for the facilitator to start the next round…';
}

// ─── Leaderboard ──────────────────────────────────────────────
function renderLeaderboard(teams, bodyId, currentRound) {
  const tbody = document.getElementById(bodyId);
  if (!tbody) return;
  const sorted = [...teams].sort((a,b) => (b.total_revenue||0) - (a.total_revenue||0));
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gev-gray-500);">No teams yet</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  sorted.forEach((team, i) => {
    const rank = i + 1;
    const rankClass = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const isYou = team.id === state.teamId;
    const roundData = team.team_rounds?.find(r => r.round_number === currentRound);
    const submitted = roundData?.submitted;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="rank-cell"><span class="rank-num ${rankClass}">${rank}</span></div></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div class="team-chip" style="background:${team.color||'#4DA8FF'};"></div>
          <span class="team-name-cell">${team.name}${isYou?'<span class="you-badge">You</span>':''}</span>
        </div>
      </td>
      <td>${submitted?`<span class="submitted-check done">✓</span>`:`<span class="submitted-check waiting">…</span>`}</td>
      <td class="revenue-cell">${roundData?.revenue != null ? roundData.revenue.toLocaleString() : '—'}</td>
      <td class="revenue-cell" style="color:var(--gev-blue-light);font-weight:700;">${(team.total_revenue||0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Final screen ─────────────────────────────────────────────
function renderFinalScreen(teams) {
  const sorted = [...teams].sort((a,b) => (b.total_revenue||0) - (a.total_revenue||0));
  if (sorted.length > 0) {
    const w = sorted[0];
    setText('final-winner-name',    w.name);
    setText('final-winner-revenue', `${(w.total_revenue||0).toLocaleString()} pts cumulative`);
  }
  const tbody = document.getElementById('final-leaderboard-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  sorted.forEach((team, i) => {
    const rank = i+1;
    const rankClass = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const isYou = team.id === state.teamId;
    const rounds = team.team_rounds || [];
    const rev = r => { const d = rounds.find(x=>x.round_number===r); return d?.revenue != null ? d.revenue.toLocaleString() : '—'; };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="rank-cell"><span class="rank-num ${rankClass}">${rank}</span></div></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div class="team-chip" style="background:${team.color||'#4DA8FF'};"></div>
          <span class="team-name-cell">${team.name}${isYou?'<span class="you-badge">You</span>':''}</span>
        </div>
      </td>
      <td>${rev(1)}</td><td>${rev(2)}</td><td>${rev(3)}</td><td>${rev(4)}</td>
      <td style="color:var(--gev-gold);font-weight:700;">${(team.total_revenue||0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Full state refresh from Supabase ────────────────────────
async function refreshState() {
  const [{ data: gameRow }, { data: teams }] = await Promise.all([
    sb.from('game_state').select('*').eq('id', 1).single(),
    sb.from('teams').select('*, team_rounds(*)').order('total_revenue', { ascending: false }),
  ]);
  if (!gameRow || !teams) return;

  const status = gameRow.status || 'lobby';
  const round  = gameRow.current_round || 0;
  const myTeam = teams.find(t => t.id === state.teamId);

  updateHeaderStatus(status);
  state.gameStatus   = status;
  state.currentRound = round;

  if (status === 'lobby') {
    setScreen('lobby');
    renderLobbyTeams(teams);
    return;
  }

  const roundMatch = status.match(/^round(\d)$/);
  if (roundMatch) {
    const r = parseInt(roundMatch[1], 10);
    if (state.currentRound !== r || !state.hasSubmitted) {
      // New round started
      if (state.gameStatus !== status) resetRoundUI();
      state.hasSubmitted = !!(myTeam?.team_rounds?.find(x => x.round_number === r && x.submitted));
    }
    setScreen('round');
    setText('round-num',      r.toString());
    setText('event-round-num', r.toString());
    updateRoundPips(r);
    renderEventCard(r - 1);
    if (state.timerRemaining >= SIM.game.roundDuration - 5 && !state.timerInterval) {
      startLocalTimer(SIM.game.roundDuration);
    }

    if (state.hasSubmitted) {
      hide('submit-btn');
      show('submitted-banner');
      const btn = document.getElementById('submit-btn');
      if (btn) btn.disabled = true;
    }
    return;
  }

  const resultsMatch = status.match(/^results(\d)$/);
  if (resultsMatch) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    const r = parseInt(resultsMatch[1], 10);
    const myRoundData = myTeam?.team_rounds?.find(x => x.round_number === r);
    setScreen('results');
    setText('result-round-num', r.toString());
    renderResultsScreen(myRoundData, r - 1, myTeam, teams);
    return;
  }

  if (status === 'final') {
    clearInterval(state.timerInterval);
    clearInterval(pollingInterval);
    state.timerInterval = null;
    setScreen('final');
    renderFinalScreen(teams);
  }
}

// ─── Round pips ───────────────────────────────────────────────
function updateRoundPips(round) {
  for (let i = 1; i <= 4; i++) {
    const pip = document.getElementById(`pip-${i}`);
    if (!pip) continue;
    pip.className = 'round-pip';
    if (i < round) pip.classList.add('done');
    else if (i === round) pip.classList.add('current');
  }
}

// ─── Submit allocation ────────────────────────────────────────
async function submitAllocation() {
  const { power, wind, electrification } = getSliderValues();
  if (power + wind + electrification !== 100) {
    showToast('Allocation must total exactly 100 points.', 'error');
    return;
  }

  const round   = state.currentRound;
  const roundI  = round - 1;
  const revenue = calculateRoundRevenue(power, wind, electrification, state.selectedStrategy, roundI);

  const btn = document.getElementById('submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    // Upsert round data
    const { error: roundErr } = await sb.from('team_rounds').upsert({
      team_id:         state.teamId,
      round_number:    round,
      power, wind, electrification,
      strategy:        state.selectedStrategy,
      revenue,
      submitted:       true,
      submitted_at:    new Date().toISOString(),
    }, { onConflict: 'team_id,round_number' });

    if (roundErr) throw roundErr;

    // Get current total and add this round's revenue
    const { data: teamRow } = await sb.from('teams').select('total_revenue').eq('id', state.teamId).single();
    const prevTotal = teamRow?.total_revenue || 0;

    await sb.from('teams').update({
      total_revenue: prevTotal + revenue,
      last_active:   new Date().toISOString(),
    }).eq('id', state.teamId);

    state.hasSubmitted = true;
    if (btn) { btn.textContent = 'Submit Allocation'; hide('submit-btn'); }
    show('submitted-banner');
    showToast('Allocation submitted!', 'success');
  } catch (err) {
    console.error('Submit error:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Allocation'; }
    showToast('Submission failed. Please try again.', 'error');
  }
}

// ─── Join game ────────────────────────────────────────────────
async function joinGame(name) {
  // Pick color based on existing team count (plain select avoids HEAD request issues)
  const { data: existing } = await sb.from('teams').select('id');
  const color = TEAM_COLORS[((existing?.length) || 0) % TEAM_COLORS.length];

  const { data: team, error } = await sb.from('teams').insert({ name, color }).select().single();
  if (error) throw error;

  state.teamId   = team.id;
  state.teamName = team.name;
  state.teamColor = team.color;

  sessionStorage.setItem('gev_teamId',   team.id);
  sessionStorage.setItem('gev_teamName', team.name);
  sessionStorage.setItem('gev_teamColor', team.color);

  const headerName = document.getElementById('header-team-name');
  if (headerName) { headerName.textContent = name; headerName.classList.remove('hidden'); }
  setText('lobby-team-name', name);

  return team.id;
}

// ─── Subscribe to real-time changes ──────────────────────────
function subscribeToGame() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  if (pollingInterval)  clearInterval(pollingInterval);

  // WebSocket subscriptions (bonus — works when Supabase realtime is fully available)
  realtimeChannel = sb.channel('game-room')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state'  }, refreshState)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams'       }, refreshState)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rounds' }, refreshState)
    .subscribe();

  // REST polling every 3 s — primary sync mechanism, guarantees state stays current
  refreshState();
  pollingInterval = setInterval(refreshState, 3000);
}

// ─── Boot ────────────────────────────────────────────────────
async function init() {
  sb = window._sb;

  try {
    const resp = await fetch('./data/simulation.json');
    SIM = await resp.json();
  } catch (err) {
    showToast('Could not load game configuration.', 'error');
    return;
  }

  // Returning team via sessionStorage
  const savedId   = sessionStorage.getItem('gev_teamId');
  const savedName = sessionStorage.getItem('gev_teamName');
  const savedColor = sessionStorage.getItem('gev_teamColor');

  if (savedId && savedName) {
    state.teamId    = savedId;
    state.teamName  = savedName;
    state.teamColor = savedColor;
    const headerName = document.getElementById('header-team-name');
    if (headerName) { headerName.textContent = savedName; headerName.classList.remove('hidden'); }
    setText('lobby-team-name', savedName);

    await sb.from('teams').update({ last_active: new Date().toISOString() }).eq('id', savedId).catch(() => {});
    subscribeToGame();
    return;
  }

  // Join form
  const joinBtn   = document.getElementById('join-btn');
  const nameInput = document.getElementById('team-name-input');
  const joinError = document.getElementById('join-error');

  const doJoin = async () => {
    const name = nameInput?.value.trim();
    if (!name || name.length < 2) {
      if (joinError) { joinError.textContent = name ? 'Name must be at least 2 characters.' : 'Please enter a team name.'; joinError.classList.remove('hidden'); }
      return;
    }
    if (joinBtn) { joinBtn.disabled = true; joinBtn.textContent = 'Joining…'; }
    if (joinError) joinError.classList.add('hidden');
    try {
      await joinGame(name);
      subscribeToGame();
    } catch (err) {
      console.error(err);
      if (joinError) { joinError.textContent = 'Join failed. Check your connection.'; joinError.classList.remove('hidden'); }
      if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'Join Game →'; }
    }
  };

  joinBtn?.addEventListener('click', doJoin);
  nameInput?.addEventListener('keydown', e => e.key === 'Enter' && doJoin());

  // Sliders
  ['power','wind','electrification'].forEach(seg => {
    const slider = document.getElementById(`slider-${seg}`);
    if (!slider) return;
    slider.addEventListener('input', () => { updateSliderBackground(slider); updateTotalBar(); });
    updateSliderBackground(slider);
  });
  updateTotalBar();

  document.getElementById('submit-btn')?.addEventListener('click', submitAllocation);
  setupStrategyButtons();
}

// `defer` guarantees DOM is parsed and window._sb is set before this runs
init();
