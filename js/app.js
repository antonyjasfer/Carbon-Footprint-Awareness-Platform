/**
 * @module app
 * @description Main SPA controller — bootstraps all modules, handles routing
 *  between sections, coordinates Living World updates, and wires up all UI
 *  event listeners.
 *
 *  Sections: dashboard | world | logger | insights | social | goals
 */

import { storage }    from './storage.js';
import { EMISSION_FACTORS, CHALLENGES, ACHIEVEMENTS } from './data.js';
import { submitActivity, previewEmission, computeStats, computeWorldHealth } from './tracker.js';
import { LivingWorld } from './world.js';
import { renderWeeklyChart, renderCategoryChart, renderTrendChart, renderCarbonHeatmap } from './charts.js';
import { fetchInsights, renderInsights }     from './insights.js';
import { renderIndividualLeaderboard, renderTeamLeaderboard, createTeam, joinTeam } from './social.js';
import { showToast, announce, initSkipLink, initKeyboardShortcuts, registerShortcut, trapFocus, focusFirst } from './accessibility.js';

// ─────────────────────────────────────────────────────────────────────────────
// App state
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  currentSection: 'dashboard',
  livingWorld:    null,
  insightsLoading: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

function navigateTo(sectionId) {
  if (state.currentSection === sectionId) {return;}

  // Hide current section
  document.querySelectorAll('.section').forEach(s => {
    s.hidden = true;
    s.setAttribute('aria-hidden', 'true');
  });

  // Show target section
  const target = document.getElementById(`section-${sectionId}`);
  if (!target) {return;}
  target.hidden = false;
  target.setAttribute('aria-hidden', 'false');

  // Update nav active state
  document.querySelectorAll('[data-nav]').forEach(btn => {
    const active = btn.dataset.nav === sectionId;
    btn.classList.toggle('nav-btn--active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  state.currentSection = sectionId;
  announce(`Navigated to ${sectionId} section`);

  // Section-specific initialisation on first visit
  onSectionEnter(sectionId);
}

function onSectionEnter(sectionId) {
  switch (sectionId) {
    case 'dashboard':
      refreshDashboard();
      break;
    case 'world':
      // Ensure world is running
      if (state.livingWorld) {
        const stats = computeStats();
        state.livingWorld.setHealth(computeWorldHealth(stats.avgDailyKg));
      }
      break;
    case 'logger':
      resetLoggerForm();
      break;
    case 'insights':
      // Auto-load static insights first time
      if (!document.getElementById('insights-output')?.children.length) {
        loadInsights();
      }
      break;
    case 'social':
      refreshSocial();
      break;
    case 'goals':
      refreshGoals();
      break;
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function refreshDashboard() {
  const stats = computeStats();
  const health = computeWorldHealth(stats.avgDailyKg);

  // Update Living World
  if (state.livingWorld) {state.livingWorld.setHealth(health);}

  // Update world info panel
  const el_wi_health = document.getElementById('wi-health');
  const el_wi_avg    = document.getElementById('wi-avg');
  if (el_wi_health) {el_wi_health.textContent = `${health}%`;}
  if (el_wi_avg)    {el_wi_avg.textContent    = formatKg(stats.avgDailyKg);}

  // Stat cards
  setText('stat-today',      formatKg(stats.todayKg));
  setText('stat-week',       formatKg(stats.weekKg));
  setText('stat-streak',     `${stats.currentStreak} days`);
  setText('stat-avg',        formatKg(stats.avgDailyKg));
  setText('stat-equivalence', stats.equivalence);

  // Emotional context banner
  const ctx = stats.emotionalContext;
  const banner = document.getElementById('emotion-banner');
  if (banner) {
    banner.textContent = `${ctx.emoji} ${ctx.label} — ${stats.equivalence}`;
    banner.style.color = ctx.color;
    banner.className   = `emotion-banner emotion-banner--${ctx.tier}`;
  }

  // Health percentage
  setText('world-health-pct', `${health}%`);

  // vs benchmarks
  setContextBar('bar-vs-paris',  stats.todayKg, 6.3);
  setContextBar('bar-vs-global', stats.todayKg, 12.0);
  setContextBar('bar-vs-hero',   stats.todayKg, 3.0);

  // Charts
  renderWeeklyChart('chart-weekly');
  renderCategoryChart('chart-category');
  renderTrendChart('chart-trend', stats.days30);

  // Carbon heatmap (GitHub-style 30-day grid)
  renderCarbonHeatmap('carbon-heatmap', stats.days30);

  // Forecast widget
  renderForecastWidget(stats);

  // Recent activities
  renderRecentActivities();

  // Achievements preview
  renderAchievements('achievements-preview', 4);
}

/**
 * Renders the forecast + budget countdown widget into #forecast-widget.
 * Shows projected monthly total, trend direction, and days remaining in budget.
 *
 * @param {import('./tracker.js').TrackerStats} stats
 */
function renderForecastWidget(stats) {
  const container = document.getElementById('forecast-widget');
  if (!container) { return; }

  const { forecast, budgetRemaining, budgetDaysLeft, monthlyBudget } = stats;
  if (!forecast) { return; }

  const STATUS_COLORS = { on_track: '#22c55e', at_risk: '#f59e0b', over_budget: '#ef4444' };
  const STATUS_LABELS = { on_track: '✅ On Track', at_risk: '⚠️ At Risk', over_budget: '🔴 Over Budget' };
  const trendArrow    = forecast.improving ? '↘️ Improving' : (forecast.trendSlope > 0.01 ? '↗️ Rising' : '→ Stable');
  const statusColor   = STATUS_COLORS[forecast.status] ?? '#94a3b8';
  const statusLabel   = STATUS_LABELS[forecast.status] ?? forecast.status;
  const budgetPct     = Math.min(100, (stats.monthKg / monthlyBudget) * 100);

  container.innerHTML = `
    <div class="forecast-card" role="region" aria-label="Carbon budget forecast">
      <div class="forecast-card__header">
        <span class="forecast-icon" aria-hidden="true">📊</span>
        <h3 class="forecast-card__title">Monthly Forecast</h3>
        <span class="forecast-status" style="color:${statusColor}">${statusLabel}</span>
      </div>
      <div class="forecast-grid">
        <div class="forecast-stat">
          <span class="forecast-stat__value">${formatKg(forecast.projectedMonthlyKg)}</span>
          <span class="forecast-stat__label">Projected this month</span>
        </div>
        <div class="forecast-stat">
          <span class="forecast-stat__value">${formatKg(budgetRemaining)}</span>
          <span class="forecast-stat__label">Budget remaining</span>
        </div>
        <div class="forecast-stat">
          <span class="forecast-stat__value">${budgetDaysLeft}d</span>
          <span class="forecast-stat__label">Days left in month</span>
        </div>
        <div class="forecast-stat">
          <span class="forecast-stat__value" style="color:${forecast.improving ? '#22c55e' : '#f97316'}">${trendArrow}</span>
          <span class="forecast-stat__label">7-day trend</span>
        </div>
      </div>
      <div class="forecast-budget-bar" role="progressbar"
           aria-valuenow="${Math.round(budgetPct)}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${Math.round(budgetPct)}% of monthly budget used">
        <div class="forecast-budget-bar__fill" style="width:${budgetPct}%;background:${statusColor}"></div>
      </div>
      <p class="forecast-budget-label">${Math.round(budgetPct)}% of ${formatKg(monthlyBudget)} monthly budget used</p>
    </div>`;
}

function setContextBar(id, actual, target) {
  const el = document.getElementById(id);
  if (!el) {return;}
  const pct = Math.min(200, target > 0 ? (actual / target) * 100 : 0);
  el.style.width = `${Math.min(pct, 100)}%`;
  el.style.background = pct <= 100 ? '#22c55e' : '#ef4444';
}

function formatKg(kg) {
  if (kg === 0) {return '0.00 kg';}
  if (kg >= 1000) {return `${(kg / 1000).toFixed(2)} t`;}
  return `${kg.toFixed(2)} kg`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {el.textContent = text;}
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent activity list
// ─────────────────────────────────────────────────────────────────────────────

function renderRecentActivities() {
  const container = document.getElementById('recent-activities');
  if (!container) {return;}

  const activities = storage.getTodayActivities().slice(0, 10);

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state" role="status">
        <span aria-hidden="true">📋</span>
        <p>No activities logged today yet.<br>Start tracking to see your footprint!</p>
      </div>`;
    return;
  }

  const catIcons = { transport: '🚗', food: '🍔', energy: '⚡', shopping: '🛍️', travel: '✈️' };

  container.innerHTML = activities.map(a => `
    <div class="activity-item" role="listitem">
      <span class="activity-icon" aria-hidden="true">${catIcons[a.category] ?? '📌'}</span>
      <span class="activity-info">
        <span class="activity-label">${a.label}</span>
        <span class="activity-time">${formatRelativeTime(a.timestamp)}</span>
      </span>
      <span class="activity-kg" aria-label="${a.kgCO2} kg CO₂">
        ${a.kgCO2 === 0 ? '<span class="zero-emission">🌿 Zero</span>' : `${a.kgCO2.toFixed(2)} kg`}
      </span>
      <button class="btn-icon delete-btn" data-id="${a.id}" 
              aria-label="Delete activity: ${a.label}" title="Delete">✕</button>
    </div>
  `).join('');

  // Delete handlers
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      storage.deleteActivity(btn.dataset.id);
      refreshDashboard();
      showToast('Activity deleted', 'info', 2000);
    });
  });
}

function formatRelativeTime(isoTimestamp) {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  {return 'just now';}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  {return `${hrs}h ago`;}
  return new Date(isoTimestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Logger
// ─────────────────────────────────────────────────────────────────────────────

function resetLoggerForm() {
  const form = document.getElementById('logger-form');
  if (form) {form.reset();}
  buildTypeOptions('transport');
  updateLivePreview();
}

function buildTypeOptions(category) {
  const select = document.getElementById('log-type');
  if (!select) {return;}

  const factors = EMISSION_FACTORS[category] ?? {};
  select.innerHTML = Object.entries(factors).map(([key, val]) =>
    `<option value="${key}">${val.icon ?? ''} ${val.label}</option>`
  ).join('');

  updateAmountLabel(category, select.value);
  updateLivePreview();
}

function updateAmountLabel(category, type) {
  const label = document.getElementById('amount-unit-label');
  if (!label) {return;}
  const factor = EMISSION_FACTORS[category]?.[type];
  label.textContent = factor?.unit ?? 'units';
}

function updateLivePreview() {
  const category = document.getElementById('log-category')?.value;
  const type     = document.getElementById('log-type')?.value;
  const amount   = parseFloat(document.getElementById('log-amount')?.value ?? 0);

  const preview = previewEmission(category, type, isNaN(amount) ? 0 : amount);

  setText('preview-kg',   `${preview.kgCO2.toFixed(3)} kg CO₂e`);
  setText('preview-eq',   preview.equivalence || '—');

  // Nudge
  const nudgeEl = document.getElementById('preview-nudge');
  if (nudgeEl) {
    if (preview.nudge) {
      nudgeEl.innerHTML = `
        <span class="nudge-icon" aria-hidden="true">💡</span>
        <span>${preview.nudge.message}</span>
        <strong class="nudge-saving">Save ${preview.nudge.savings.toFixed(2)} kg CO₂!</strong>`;
      nudgeEl.hidden = false;
    } else {
      nudgeEl.hidden = true;
    }
  }

  // Color feedback on preview card
  const card = document.getElementById('preview-card');
  if (card && preview.context) {
    card.style.borderColor = preview.context.color;
  }
}

async function handleLogSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('log-category')?.value;
  const type     = document.getElementById('log-type')?.value;
  const amount   = parseFloat(document.getElementById('log-amount')?.value);
  const note     = document.getElementById('log-note')?.value ?? '';

  if (!category || !type || isNaN(amount) || amount < 0) {
    showToast('Please fill in all fields correctly', 'error');
    return;
  }

  try {
    const result = submitActivity(category, type, amount, note);

    // Update Living World immediately
    const stats = computeStats();
    if (state.livingWorld) {state.livingWorld.setHealth(computeWorldHealth(stats.avgDailyKg));}

    // Toast
    const icon = EMISSION_FACTORS[category]?.[type]?.icon ?? '📌';
    const msg  = result.kgCO2 === 0
      ? `${icon} Logged! Zero emissions — excellent choice! 🌿`
      : `${icon} Logged ${result.kgCO2.toFixed(2)} kg CO₂ — ${result.stats.equivalence}`;
    showToast(msg, result.kgCO2 <= 3 ? 'success' : 'info', 5000);

    // New achievements
    for (const ach of result.newAchievements) {
      setTimeout(() => showToast(`🏅 Achievement unlocked: ${ach.title}!`, 'success', 6000), 1000);
    }

    // Show nudge in a persistent area if applicable
    if (result.nudge) {
      showNudgeModal(result.nudge);
    }

    // Reset form & refresh dashboard
    document.getElementById('logger-form')?.reset();
    buildTypeOptions(category);
    updateLivePreview();

    // If on dashboard, refresh it
    if (state.currentSection === 'dashboard') {refreshDashboard();}

  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

function showNudgeModal(nudge) {
  const modal = document.getElementById('nudge-modal');
  if (!modal) {return;}

  document.getElementById('nudge-modal-text').textContent = nudge.message;
  document.getElementById('nudge-modal-saving').textContent =
    `💚 You could save ${nudge.savings.toFixed(2)} kg CO₂ by choosing ${nudge.altLabel}`;

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  const cleanup = trapFocus(modal);
  focusFirst(modal);

  const close = () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    cleanup();
  };
  modal.querySelector('.modal-close')?.addEventListener('click', close, { once: true });
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close, { once: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights
// ─────────────────────────────────────────────────────────────────────────────

async function loadInsights(apiKeyOverride) {
  if (state.insightsLoading) {return;}
  state.insightsLoading = true;

  const btn = document.getElementById('btn-generate-insights');
  const out = document.getElementById('insights-output');

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  if (out) {out.innerHTML = '<div class="loading-spinner" role="status" aria-label="Loading insights"></div>';}

  try {
    const result = await fetchInsights(apiKeyOverride);
    renderInsights(result);
    if (result.source === 'gemini') {showToast('✨ Gemini AI insights loaded!', 'success');}
  } catch (err) {
    if (out) {out.innerHTML = `<p class="insights-error">Failed to load insights: ${err.message}</p>`;}
    showToast('Could not load insights', 'error');
  } finally {
    state.insightsLoading = false;
    if (btn) { btn.disabled = false; btn.textContent = '✨ Generate Insights'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Social
// ─────────────────────────────────────────────────────────────────────────────

function refreshSocial() {
  renderIndividualLeaderboard('individual-leaderboard');
  renderTeamLeaderboard('team-leaderboard');

  const settings = storage.getSettings();
  const teamSection = document.getElementById('my-team-info');
  if (teamSection) {
    if (settings.teamName) {
      teamSection.innerHTML = `
        <div class="team-card">
          <span class="team-card__icon">⭐</span>
          <div>
            <strong>${settings.teamName}</strong>
            <p>Your team</p>
          </div>
          <button class="btn btn--ghost btn--sm" id="btn-leave-team">Leave</button>
        </div>`;
      document.getElementById('btn-leave-team')?.addEventListener('click', () => {
        // eslint-disable-next-line no-alert
        if (confirm('Leave your team?')) {
          storage.saveSettings({ teamId: null, teamName: null });
          refreshSocial();
          showToast('Left your team', 'info');
        }
      });
    } else {
      teamSection.innerHTML = '<p class="muted">You haven\'t joined a team yet.</p>';
    }
  }
}

function handleCreateTeam(e) {
  e.preventDefault();
  const name = document.getElementById('team-name-input')?.value?.trim();
  const result = createTeam(name);
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) {refreshSocial();}
}

function handleJoinTeam(e) {
  e.preventDefault();
  const name = document.getElementById('join-team-input')?.value?.trim();
  const result = joinTeam(name);
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) {refreshSocial();}
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals & Challenges
// ─────────────────────────────────────────────────────────────────────────────

function refreshGoals() {
  renderGoalsSection();
  renderAchievements('achievements-full', 999);
}

function renderGoalsSection() {
  const container = document.getElementById('challenges-list');
  if (!container) {return;}

  const challengeState = storage.getChallengesState();

  container.innerHTML = CHALLENGES.map(ch => {
    const chState  = challengeState[ch.id];
    const active   = !!chState && !chState.completed;
    const done     = !!chState?.completed;
    const progress = chState?.progress ?? 0;
    const pct      = Math.min(100, (progress / ch.target) * 100);

    return `
      <div class="challenge-card ${done ? 'challenge-card--done' : ''}" 
           role="article" aria-label="${ch.title} challenge">
        <div class="challenge-card__header">
          <span class="challenge-icon" aria-hidden="true">${ch.icon}</span>
          <div class="challenge-meta">
            <h3 class="challenge-title">${ch.title}</h3>
            <p class="challenge-desc">${ch.description}</p>
          </div>
          ${done ? '<span class="badge badge--green">✅ Done</span>' : ''}
        </div>
        <div class="challenge-details">
          <span class="challenge-saving">💚 Saves ~${ch.co2Saving} kg CO₂</span>
          <span class="challenge-reward">🏅 ${ch.reward}</span>
        </div>
        ${active ? `
          <div class="progress-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar__fill" style="width:${pct}%"></div>
          </div>
          <p class="progress-text">${progress} / ${ch.target} ${ch.unit}</p>
        ` : ''}
        ${!active && !done ? `
          <button class="btn btn--primary btn--sm" data-challenge="${ch.id}">
            Start Challenge
          </button>
        ` : ''}
      </div>`;
  }).join('');

  // Start challenge handlers
  container.querySelectorAll('[data-challenge]').forEach(btn => {
    btn.addEventListener('click', () => {
      storage.startChallenge(btn.dataset.challenge);
      showToast('Challenge started! Keep it up! 💪', 'success');
      refreshGoals();
    });
  });
}

function renderAchievements(containerId, limit = 999) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  const unlocked = storage.getUnlockedAchievements();
  const stats    = computeStats();

  const displayed = ACHIEVEMENTS.slice(0, limit);

  container.innerHTML = displayed.map(ach => {
    const isUnlocked = unlocked.includes(ach.id);
    const isClose    = !isUnlocked && ach.condition({ ...stats, teamRank: 5 });

    return `
      <div class="achievement-badge ${isUnlocked ? 'achievement-badge--unlocked' : 'achievement-badge--locked'}"
           role="img" aria-label="${ach.title}: ${ach.description}. ${isUnlocked ? 'Unlocked' : 'Locked'}">
        <span class="ach-icon" aria-hidden="true">${isUnlocked ? ach.icon : '🔒'}</span>
        <span class="ach-title">${ach.title}</span>
        ${isUnlocked ? '<span class="ach-unlocked-mark" aria-hidden="true">✓</span>' : ''}
        ${isClose ? '<span class="ach-close" aria-hidden="true">Almost!</span>' : ''}
        <div class="ach-tooltip" role="tooltip">${ach.description}<br><em>${ach.rarity}</em></div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings / Profile
// ─────────────────────────────────────────────────────────────────────────────

function initSettings() {
  const settings = storage.getSettings();
  const user     = storage.getUser();

  setInputValue('profile-name',    user.name ?? '');
  setInputValue('daily-target',    settings.dailyTarget ?? 6.3);
  setInputValue('settings-api-key', ''); // Never pre-fill API key for security
  setInputValue('settings-team-name', settings.teamName ?? '');

  document.getElementById('settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name       = document.getElementById('profile-name')?.value?.trim();
    const target     = parseFloat(document.getElementById('daily-target')?.value);
    const apiKey     = document.getElementById('settings-api-key')?.value?.trim();

    if (name)   {storage.saveUser({ name });}
    if (!isNaN(target) && target > 0) {storage.saveSettings({ dailyTarget: target, weeklyTarget: target * 7 });}
    if (apiKey !== undefined) {storage.saveSettings({ geminiApiKey: apiKey });}

    // Update display name
    setText('nav-username', name || 'You');
    showToast('Settings saved!', 'success');
  });
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) {el.value = value;}
}

// ─────────────────────────────────────────────────────────────────────────────
// API key toggle visibility
// ─────────────────────────────────────────────────────────────────────────────

function initApiKeyToggle() {
  const toggle = document.getElementById('toggle-api-key');
  const input  = document.getElementById('insights-api-key');
  if (!toggle || !input) {return;}

  toggle.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? '👁️' : '🙈';
    toggle.setAttribute('aria-label', visible ? 'Show API key' : 'Hide API key');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Living World init
// ─────────────────────────────────────────────────────────────────────────────

function initLivingWorld() {
  state.livingWorld = new LivingWorld('world-canvas');
  const stats  = computeStats();
  state.livingWorld.setHealth(computeWorldHealth(stats.avgDailyKg));
  state.livingWorld.start();
}

// ─────────────────────────────────────────────────────────────────────────────
// Event wiring
// ─────────────────────────────────────────────────────────────────────────────

function wireEvents() {
  // Navigation
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
  });

  // Category tab buttons (data-cat)
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      // Update hidden input
      const catInput = document.getElementById('log-category');
      if (catInput) {catInput.value = cat;}
      // Update aria-pressed
      document.querySelectorAll('[data-cat]').forEach(b => {
        b.classList.remove('cat-tab--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('cat-tab--active');
      btn.setAttribute('aria-pressed', 'true');
      // Rebuild type options
      buildTypeOptions(cat);
      updateLivePreview();
    });
  });

  // Logger form
  const logCatSelect = document.getElementById('log-category');
  logCatSelect?.addEventListener('change', (e) => {
    buildTypeOptions(e.target.value);
    updateLivePreview();
  });

  document.getElementById('log-type')?.addEventListener('change', (e) => {
    const cat = document.getElementById('log-category')?.value;
    updateAmountLabel(cat, e.target.value);
    updateLivePreview();
  });

  document.getElementById('log-amount')?.addEventListener('input', updateLivePreview);

  document.getElementById('logger-form')?.addEventListener('submit', handleLogSubmit);

  // Insights
  document.getElementById('btn-generate-insights')?.addEventListener('click', () => {
    const key = document.getElementById('insights-api-key')?.value?.trim();
    if (key) {storage.saveSettings({ geminiApiKey: key });}
    loadInsights(key || undefined);
  });

  initApiKeyToggle();

  // Social
  document.getElementById('form-create-team')?.addEventListener('submit', handleCreateTeam);
  document.getElementById('form-join-team')?.addEventListener('submit', handleJoinTeam);

  // Leaderboard tabs
  document.querySelectorAll('[data-lb-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.lbTab;
      document.querySelectorAll('[data-lb-tab]').forEach(b => b.classList.remove('tab--active'));
      btn.classList.add('tab--active');
      document.getElementById('individual-leaderboard').hidden = tab !== 'individual';
      document.getElementById('team-leaderboard').hidden       = tab !== 'team';
    });
  });

  // Settings
  initSettings();

  // Modal close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not([hidden])').forEach(m => {
        m.hidden = true;
        m.setAttribute('aria-hidden', 'true');
      });
    }
  });

  // Quick-log FAB
  document.getElementById('fab-log')?.addEventListener('click', () => navigateTo('logger'));

  // Settings modal
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    const modal = document.getElementById('settings-modal');
    if (!modal) {return;}
    const isHidden = modal.hidden;
    modal.hidden = !isHidden;
    modal.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    if (isHidden) { trapFocus(modal); focusFirst(modal); }
  });
  const closeSettings = () => {
    const modal = document.getElementById('settings-modal');
    if (modal) { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); }
  };
  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettings);
  document.getElementById('btn-close-settings-x')?.addEventListener('click', closeSettings);

  // Debug: run tests
  document.getElementById('btn-run-tests')?.addEventListener('click', () => {
    const panel = document.getElementById('test-results-panel');
    if (panel) {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        import('./tests.js').then(m => m.renderTestResults('test-results'));
      }
    }
  });

  // Export data
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const data = storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `carbon-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
  });

  // Keyboard shortcuts
  registerShortcut('d', () => navigateTo('dashboard'));
  registerShortcut('w', () => navigateTo('world'));
  registerShortcut('l', () => navigateTo('logger'));
  registerShortcut('i', () => navigateTo('insights'));
  registerShortcut('s', () => navigateTo('social'));
  registerShortcut('g', () => navigateTo('goals'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  // Init a11y
  initSkipLink();
  initKeyboardShortcuts();

  // Set user name in nav
  const user = storage.getUser();
  setText('nav-username', user.name ?? 'You');

  // Init Living World (runs in background always)
  initLivingWorld();

  // Wire all event listeners
  wireEvents();

  // Show dashboard on load
  navigateTo('dashboard');

  // Build initial category options for logger
  buildTypeOptions('transport');

  console.info('[CarbonApp] Initialised ✅');
  console.info('[CarbonApp] Alt+D=Dashboard, Alt+W=World, Alt+L=Logger, Alt+I=Insights, Alt+S=Social, Alt+G=Goals');
}

// ─────────────────────────────────────────────────────────────────────────────
// Global bridge for category tab inline onclick (avoids eval / unsafe-inline)
// The HTML cat-tab buttons call window.__catChange(cat) via onclick attr
// This bridge is set up during init so it's always ready before user clicks.
// ─────────────────────────────────────────────────────────────────────────────
function setupCatChangeBridge() {
  window.__catChange = (cat) => {
    buildTypeOptions(cat);
    updateLivePreview();
  };
}

// Expose public functions needed by the HTML bridge script tags
export { buildTypeOptions, updateLivePreview };

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { setupCatChangeBridge(); init(); });
} else {
  setupCatChangeBridge();
  init();
}
