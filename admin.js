/* GE Vernova Strategy Lab — Admin / Facilitator Logic (Supabase) */

'use strict';

const ADMIN_PIN      = 'GEV2025';
const ROUND_DURATION = 120;

let SIM = null;
let sb  = null;
let realtimeChannel = null;
let pollingInterval = null;

// ─── Admin state ──────────────────────────────────────────────
const adminState = {
  authenticated:  false,
  currentRound:   0,
  gameStatus:     'lobby',
  teams:          [],
  manualStrategy: 'balanced',
  timerInterval:  null,
  timerRemaining: ROUND_DURATION,
  timerRunning:   false,
};

// ─── Scoring engine (mirrors app.js) ─────────────────────────
function calculateRoundRevenue(power, wind, electrification, strategy, roundIndex) {
  const event    = SIM.events[roundIndex];
  const strat    = SIM.strategies[strategy];
  const segments = SIM.segments;
  const base =
    (power/100)           * segments.power.baseScore           * event.multipliers.power +
    (wind/100)            * segments.wind.baseScore            * event.multipliers.wind +
    (electrification/100) * segments.electrification.baseScore * event.multipliers.electrification;
  const mult = event.direction === 'positive' ? strat.positiveMultiplier : strat.negativeMultiplier;
  return Math.round(base * 100 * mult);
}

// ─── UI helpers ───────────────────────────────────────────────
const show = id => document.getElementById(id)?.classList.remove('hidden');
const hide = id => document.getElementById(id)?.classList.add('hidden');
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

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

// ─── Timer ────────────────────────────────────────────────────
function formatTime(sec) {
  return `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
}

function updateAdminTimer() {
  const el = document.getElementById('admin-timer');
  if (!el) return;
  el.textContent = formatTime(adminState.timerRemaining);
  el.className = `admin-timer-display${adminState.timerRemaining<=30?' warning':''}${adminState.timerRemaining<=10?' urgent':''}`;
}

function startTimer() {
  if (adminState.timerRunning) return;
  adminState.timerRunning = true;
  adminState.timerInterval = setInterval(() => {
    adminState.timerRemaining = Math.max(0, adminState.timerRemaining - 1);
    updateAdminTimer();
    if (adminState.timerRemaining <= 0) { clearInterval(adminState.timerInterval); adminState.timerRunning = false; }
  }, 1000);
}

function pauseTimer() {
  clearInterval(adminState.timerInterval);
  adminState.timerRunning = false;
}

function resetTimer() {
  pauseTimer();
  adminState.timerRemaining = ROUND_DURATION;
  updateAdminTimer();
}

// ─── Status pill ──────────────────────────────────────────────
function updateStatusPill(status) {
  const pill = document.getElementById('admin-status-pill');
  const text = document.getElementById('admin-status-text');
  if (!pill || !text) return;
  const m = status.match(/^(round|results)(\d)$/);
  const cls  = m ? (status.startsWith('round')?'active':'results') : (status==='final'?'final':'lobby');
  const label = m
    ? (status.startsWith('round') ? `Round ${m[2]} Active` : `Round ${m[2]} Results`)
    : (status==='final' ? 'Final Results' : 'Lobby');
  pill.className = `status-pill ${cls}`;
  pill.innerHTML = `<span class="status-dot"></span>`;
  text.textContent = label;
}

// ─── Control panel ────────────────────────────────────────────
function updateControlPanel(status, teams) {
  const round     = adminState.currentRound;
  const submitted = teams.filter(t => t.team_rounds?.some(r => r.round_number===round && r.submitted)).length;

  const sm = status.match(/^(round|results)(\d)$/);
  const statusLabel = sm
    ? (status.startsWith('round') ? `Round ${sm[2]} — collecting` : `Round ${sm[2]} — results`)
    : status === 'final' ? 'Final results' : 'Lobby';
  setText('ctrl-round',     `${round} / 4`);
  setText('ctrl-status',    statusLabel);
  setText('ctrl-submitted', `${submitted} / ${teams.length}`);

  ['start-game-btn','reveal-results-btn','next-round-btn','final-results-btn'].forEach(id => hide(id));

  const allIn = teams.length > 0 && submitted === teams.length;

  if (status === 'lobby') {
    show('start-game-btn');
  } else if (/^round\d$/.test(status)) {
    const btn = document.getElementById('reveal-results-btn');
    show('reveal-results-btn');
    if (btn) {
      btn.textContent = allIn
        ? `📊 Reveal Round ${round} Results (all ${teams.length} in)`
        : `📊 Reveal Round ${round} Results (${submitted}/${teams.length})`;
    }
  } else if (/^results\d$/.test(status)) {
    const r = parseInt(status.replace('results',''), 10);
    if (r < 4) {
      const btn = document.getElementById('next-round-btn');
      show('next-round-btn');
      if (btn) btn.textContent = `▶ Start Round ${r + 1}`;
    } else {
      show('final-results-btn');
    }
  }
}

// ─── Event banner ─────────────────────────────────────────────
function updateEventBanner(roundIndex) {
  if (!SIM || roundIndex < 0) return;
  const event = SIM.events[roundIndex];
  if (!event) return;

  const banner = document.getElementById('event-banner');
  if (banner) banner.style.display = 'block';

  setText('event-banner-round', `Round ${event.round}`);
  setText('event-banner-name',  event.name);
  setText('event-banner-desc',  event.description);

  const dirBadge = document.getElementById('event-direction-badge');
  if (dirBadge) {
    dirBadge.className = `status-pill ${event.direction === 'positive' ? 'active' : 'results'}`;
    dirBadge.innerHTML = `<span class="status-dot"></span>${event.direction==='positive'?'Positive':'Negative'}`;
  }

  const impactsEl = document.getElementById('event-banner-impacts');
  if (impactsEl) {
    impactsEl.innerHTML = '';
    ['power','wind','electrification'].forEach(seg => {
      const pct  = Math.round((event.multipliers[seg]-1)*100);
      const cls  = pct>0?'positive':pct<0?'negative':'neutral';
      const sign = pct>=0?'+':'';
      const colors = { power:'var(--seg-power)', wind:'var(--seg-wind)', electrification:'var(--seg-electrification)' };
      const row = document.createElement('div');
      row.className = 'event-seg-row';
      row.innerHTML = `
        <span class="event-seg-name" style="color:${colors[seg]};">${seg.charAt(0).toUpperCase()+seg.slice(1)}</span>
        <div class="event-seg-track" style="flex:1;height:6px;background:var(--gev-surface-3);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.abs(pct)}%;height:100%;background:${cls==='positive'?'var(--gev-green)':cls==='negative'?'var(--gev-red)':'var(--gev-gray-500)'};border-radius:3px;"></div>
        </div>
        <span class="event-seg-pct impact-pill ${cls}" style="background:transparent;padding:0;">${sign}${pct}%</span>
      `;
      impactsEl.appendChild(row);
    });
  }

  // Sidebar
  const sec = document.getElementById('current-event-section');
  if (sec) sec.style.display = 'block';
  setText('sidebar-event-name', event.name);
  const sideImpacts = document.getElementById('sidebar-event-impacts');
  if (sideImpacts) {
    sideImpacts.innerHTML = '';
    ['power','wind','electrification'].forEach(seg => {
      const pct = Math.round((event.multipliers[seg]-1)*100);
      const cls = pct>0?'positive':pct<0?'negative':'neutral';
      const sign = pct>=0?'+':'';
      const p = document.createElement('span');
      p.className = `impact-pill ${cls}`;
      p.style.cssText = 'margin-right:4px;margin-bottom:4px;';
      p.textContent = `${seg.charAt(0).toUpperCase()+seg.slice(1)}: ${sign}${pct}%`;
      sideImpacts.appendChild(p);
    });
  }
}

// ─── Teams grid ───────────────────────────────────────────────
function renderTeamsGrid(teams, currentRound) {
  const grid = document.getElementById('teams-grid');
  if (!grid) return;
  if (teams.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">👥</div><p class="empty-state-text">No teams yet. Share the team link.</p></div>`;
    return;
  }
  const segColors = { power:'var(--seg-power)', wind:'var(--seg-wind)', electrification:'var(--seg-electrification)' };
  const stratColors = { aggressive:'var(--gev-gold)', balanced:'var(--gev-blue-light)', resilient:'var(--gev-green)' };

  grid.innerHTML = '';
  [...teams].sort((a,b)=>new Date(a.joined_at)-new Date(b.joined_at)).forEach(team => {
    const roundData = team.team_rounds?.find(r => r.round_number === currentRound);
    const submitted = roundData?.submitted || false;
    const card = document.createElement('div');
    card.className = `team-card ${submitted ? 'submitted' : 'waiting'}`;

    let body = '';
    if (roundData && submitted) {
      ['power','wind','electrification'].forEach(seg => {
        body += `<div class="team-alloc-row"><span class="team-alloc-label" style="color:${segColors[seg]};">${seg.charAt(0).toUpperCase()+seg.slice(1)}</span><span class="team-alloc-value">${roundData[seg]||0}%</span></div>`;
      });
      body += `<div class="team-alloc-row" style="margin-top:0.5rem;"><span class="team-alloc-label">Strategy</span><span class="team-alloc-value" style="color:${stratColors[roundData.strategy]||'white'};">${(roundData.strategy||'balanced').charAt(0).toUpperCase()+(roundData.strategy||'balanced').slice(1)}</span></div>`;
      body += `<div class="alloc-bars" style="margin-top:0.5rem;">
        <div class="alloc-bar-seg power"           style="width:${roundData.power||0}%;"></div>
        <div class="alloc-bar-seg wind"            style="width:${roundData.wind||0}%;"></div>
        <div class="alloc-bar-seg electrification" style="width:${roundData.electrification||0}%;"></div>
      </div>`;
    } else if (currentRound > 0) {
      body = `<p style="font-size:0.8rem;color:var(--gev-gray-500);padding:0.5rem 0;">Waiting for submission…</p>`;
    } else {
      body = `<p style="font-size:0.8rem;color:var(--gev-gray-500);padding:0.5rem 0;">Game not started yet</p>`;
    }

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-card-color" style="background:${team.color||'#4DA8FF'};"></div>
        <span class="team-card-name">${team.name}</span>
        <span class="team-card-status ${submitted?'submitted':currentRound>0?'waiting':'offline'}">
          ${submitted?'Submitted':currentRound>0?'Waiting':'Joined'}
        </span>
      </div>
      <div class="team-card-body">
        ${body}
        <div class="team-revenue">
          <span class="team-revenue-label">Total Revenue</span>
          <span class="team-revenue-value">${(team.total_revenue||0).toLocaleString()}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Admin leaderboard ────────────────────────────────────────
function renderAdminLeaderboard(teams, currentRound) {
  const tbody = document.getElementById('admin-leaderboard-body');
  if (!tbody) return;
  if (teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gev-gray-500);">No teams yet</td></tr>`;
    return;
  }
  const sorted = [...teams].sort((a,b) => (b.total_revenue||0) - (a.total_revenue||0));
  const stratColors = { aggressive:'var(--gev-gold)', balanced:'var(--gev-blue-light)', resilient:'var(--gev-green)' };

  tbody.innerHTML = '';
  sorted.forEach((team, i) => {
    const rank = i+1;
    const rankClass = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const rounds = team.team_rounds || [];
    const rev = r => { const d = rounds.find(x=>x.round_number===r); return d?.revenue != null ? d.revenue.toLocaleString() : '—'; };
    const lastStrat = rounds.find(x=>x.round_number===currentRound)?.strategy || (currentRound>0 ? rounds.find(x=>x.round_number===currentRound-1)?.strategy : null) || '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="rank-cell"><span class="rank-num ${rankClass}">${rank}</span></div></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div class="team-chip" style="background:${team.color||'#4DA8FF'};"></div>
          <span class="team-name-cell">${team.name}</span>
        </div>
      </td>
      ${[1,2,3,4].map(r=>`<td style="color:${rev(r)!=='—'?'var(--gev-gray-100)':'var(--gev-gray-500)'};">${rev(r)}</td>`).join('')}
      <td style="color:var(--gev-gold);font-weight:700;">${(team.total_revenue||0).toLocaleString()}</td>
      <td style="color:${stratColors[lastStrat]||'var(--gev-gray-300)'};font-size:0.8rem;">
        ${lastStrat!=='—' ? lastStrat.charAt(0).toUpperCase()+lastStrat.slice(1) : '—'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Stats bar ────────────────────────────────────────────────
function updateStatsBar(teams, status, currentRound) {
  setText('stat-teams',  teams.length.toString());
  setText('stat-round',  currentRound.toString());
  const m = status?.match(/^(round|results)(\d)$/);
  setText('stat-status', m ? `Rd ${m[2]}` : status==='final' ? 'Final' : 'Lobby');
  const submitted = teams.filter(t => t.team_rounds?.some(r => r.round_number===currentRound && r.submitted)).length;
  setText('stat-submitted', submitted.toString());
  setText('stat-submitted-sub', currentRound>0 ? `of ${teams.length} this round` : 'this round');
}

// ─── Full refresh ─────────────────────────────────────────────
async function refreshAdminState() {
  const [{ data: gameRow }, { data: teams }] = await Promise.all([
    sb.from('game_state').select('*').eq('id', 1).single(),
    sb.from('teams').select('*, team_rounds(*)').order('joined_at', { ascending: true }),
  ]);

  const status = gameRow?.status || 'lobby';
  const round  = gameRow?.current_round || 0;

  adminState.teams        = teams || [];
  adminState.currentRound = round;
  adminState.gameStatus   = status;

  updateStatusPill(status);
  updateStatsBar(teams || [], status, round);
  updateControlPanel(status, teams || []);
  renderTeamsGrid(teams || [], round);
  renderAdminLeaderboard(teams || [], round);

  const m = status.match(/^(?:round|results)(\d)$/);
  if (m) {
    updateEventBanner(parseInt(m[1], 10) - 1);
  } else {
    const b = document.getElementById('event-banner');
    if (b) b.style.display = 'none';
    const s = document.getElementById('current-event-section');
    if (s) s.style.display = 'none';
  }
}

// ─── Game control actions ─────────────────────────────────────
async function startGame() {
  await sb.from('game_state').update({ status: 'round1', current_round: 1, updated_at: new Date().toISOString() }).eq('id', 1);
  resetTimer(); startTimer();
  showToast('Round 1 started!', 'success');
}

async function revealResults() {
  const round = adminState.currentRound;
  await sb.from('game_state').update({ status: `results${round}`, updated_at: new Date().toISOString() }).eq('id', 1);
  pauseTimer();
  showToast(`Round ${round} results revealed.`, 'info');
}

async function startNextRound() {
  const next = adminState.currentRound + 1;
  if (next > 4) return;
  await sb.from('game_state').update({ status: `round${next}`, current_round: next, updated_at: new Date().toISOString() }).eq('id', 1);
  resetTimer(); startTimer();
  showToast(`Round ${next} started!`, 'success');
}

async function showFinalResults() {
  await sb.from('game_state').update({ status: 'final', updated_at: new Date().toISOString() }).eq('id', 1);
  pauseTimer();
  showToast('Final results revealed!', 'success');
}

async function resetGame() {
  if (!confirm('Reset the entire game? ALL team data will be permanently deleted.')) return;
  // Delete team rounds first (FK constraint), then teams
  await sb.from('team_rounds').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('game_state').update({ status: 'lobby', current_round: 0, updated_at: new Date().toISOString() }).eq('id', 1);
  resetTimer();
  showToast('Game reset. Ready for a new session.', 'info');
}

// ─── Manual entry ─────────────────────────────────────────────
function openManualModal() {
  const modal  = document.getElementById('manual-modal');
  const select = document.getElementById('manual-team-select');
  if (!modal || !select) return;
  select.innerHTML = '<option value="">Select team…</option>';
  adminState.teams.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = team.name;
    select.appendChild(opt);
  });
  modal.classList.remove('hidden');
}

function updateManualTotal() {
  const p = parseInt(document.getElementById('manual-power')?.value||0, 10);
  const w = parseInt(document.getElementById('manual-wind')?.value||0, 10);
  const e = parseInt(document.getElementById('manual-electrification')?.value||0, 10);
  const total = p + w + e;
  const bar = document.getElementById('manual-total-bar');
  const num = document.getElementById('manual-total-num');
  if (bar) {
    bar.style.width = Math.min(total, 100) + '%';
    bar.className = `total-bar-fill${total>100?' over':total===100?' exact':''}`;
  }
  if (num) {
    num.textContent = total.toString();
    num.className = `total-bar-number${total>100?' over':total===100?' exact':''}`;
  }
}

async function submitManualEntry() {
  const teamId = document.getElementById('manual-team-select')?.value;
  const power  = parseInt(document.getElementById('manual-power')?.value||0, 10);
  const wind   = parseInt(document.getElementById('manual-wind')?.value||0, 10);
  const elec   = parseInt(document.getElementById('manual-electrification')?.value||0, 10);

  if (!teamId) { showToast('Select a team.', 'error'); return; }
  if (power + wind + elec !== 100) { showToast('Allocation must total 100.', 'error'); return; }
  if (!SIM) return;

  const round   = adminState.currentRound;
  const roundI  = round - 1;
  const revenue = calculateRoundRevenue(power, wind, elec, adminState.manualStrategy, roundI);

  const { error: roundErr } = await sb.from('team_rounds').upsert({
    team_id: teamId, round_number: round,
    power, wind, electrification: elec,
    strategy: adminState.manualStrategy,
    revenue, submitted: true,
    submitted_at: new Date().toISOString(),
    entered_manually: true,
  }, { onConflict: 'team_id,round_number' });

  if (roundErr) { showToast('Error saving data.', 'error'); return; }

  // Recompute total as the SUM of all submitted rounds (idempotent — matches team-side logic)
  const { data: allRounds } = await sb.from('team_rounds')
    .select('revenue, submitted')
    .eq('team_id', teamId);
  const newTotal = (allRounds || [])
    .filter(r => r.submitted)
    .reduce((sum, r) => sum + (r.revenue || 0), 0);
  await sb.from('teams').update({ total_revenue: newTotal }).eq('id', teamId);

  const team = adminState.teams.find(t => t.id === teamId);
  document.getElementById('manual-modal')?.classList.add('hidden');
  showToast(`Submitted for ${team?.name || teamId}`, 'success');
}

// ─── Subscribe ────────────────────────────────────────────────
function subscribeToGame() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  if (pollingInterval)  clearInterval(pollingInterval);

  realtimeChannel = sb.channel('admin-room')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state'  }, refreshAdminState)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams'       }, refreshAdminState)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rounds' }, refreshAdminState)
    .subscribe();

  // REST polling every 2 s for admin — faster refresh for facilitator view
  refreshAdminState();
  pollingInterval = setInterval(refreshAdminState, 2000);
}

// ─── Team link ────────────────────────────────────────────────
function setTeamLink() {
  const link = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
  const el = document.getElementById('team-link-display');
  if (el) el.textContent = link;
  document.getElementById('copy-link-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(link).then(() => showToast('Team link copied!', 'success'));
  });
}

// ─── PIN gate ─────────────────────────────────────────────────
function setupPinGate() {
  const pinInput  = document.getElementById('pin-input');
  const pinSubmit = document.getElementById('pin-submit');
  const pinError  = document.getElementById('pin-error');

  const tryPin = () => {
    if (pinInput?.value === ADMIN_PIN) {
      document.getElementById('pin-gate')?.classList.add('hidden');
      document.getElementById('admin-app')?.classList.remove('hidden');
      adminState.authenticated = true;
      subscribeToGame();
      setTeamLink();
    } else {
      pinError?.classList.remove('hidden');
      if (pinInput) pinInput.value = '';
      pinInput?.focus();
    }
  };
  pinSubmit?.addEventListener('click', tryPin);
  pinInput?.addEventListener('keydown', e => e.key==='Enter' && tryPin());
  setTimeout(() => pinInput?.focus(), 100);
}

// ─── Wire controls ────────────────────────────────────────────
function setupControls() {
  document.getElementById('start-game-btn')?.addEventListener('click', startGame);
  document.getElementById('reveal-results-btn')?.addEventListener('click', revealResults);
  document.getElementById('next-round-btn')?.addEventListener('click', startNextRound);
  document.getElementById('final-results-btn')?.addEventListener('click', showFinalResults);
  document.getElementById('reset-btn')?.addEventListener('click', resetGame);

  document.getElementById('timer-start-btn')?.addEventListener('click', startTimer);
  document.getElementById('timer-pause-btn')?.addEventListener('click', pauseTimer);

  document.getElementById('manual-entry-btn')?.addEventListener('click', openManualModal);
  document.getElementById('manual-cancel')?.addEventListener('click', () => document.getElementById('manual-modal')?.classList.add('hidden'));
  document.getElementById('manual-submit')?.addEventListener('click', submitManualEntry);

  ['manual-power','manual-wind','manual-electrification'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', updateManualTotal)
  );

  document.querySelectorAll('#manual-modal .strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#manual-modal .strategy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      adminState.manualStrategy = btn.dataset.strategy;
    });
  });

  document.getElementById('manual-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
}

// ─── Init ────────────────────────────────────────────────────
async function init() {
  sb = window._sb;
  try {
    const resp = await fetch('./data/simulation.json');
    SIM = await resp.json();
  } catch (err) {
    console.error('Failed to load simulation data', err);
  }
  updateAdminTimer();
  setupPinGate();
  setupControls();
}

// `defer` guarantees DOM is parsed and window._sb is set before this runs
init();
