/**
 * @module tracker
 * @description Core carbon footprint calculation engine.
 *  - Computes daily / weekly / monthly totals from stored activity logs
 *  - Derives a "World Health Score" (0–100) used by the Living World canvas
 *  - Generates comparison nudges for transport choices
 *  - Checks and awards achievements
 */

import { storage } from './storage.js';
import {
  EMISSION_FACTORS,
  ACHIEVEMENTS,
  getEquivalence,
  getEmotionalContext,
  getTransportNudge,
  GLOBAL_AVG_DAILY_KG,
  PARIS_TARGET_DAILY,
  HERO_TARGET_DAILY,
} from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// Calculation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the kg CO₂e for a given activity entry.
 * @param {string} category - e.g. 'transport'
 * @param {string} type     - e.g. 'car_petrol'
 * @param {number} amount   - value in the entry's unit (km, servings, kWh…)
 * @returns {number} kg CO₂e
 */
export function calculateEmission(category, type, amount) {
  const factors = EMISSION_FACTORS[category];
  if (!factors) throw new Error(`Unknown category: ${category}`);
  const entry = factors[type];
  if (!entry) throw new Error(`Unknown type: ${type} in category: ${category}`);

  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) throw new Error(`Invalid amount: ${amount}`);

  return parseFloat((entry.factor * num).toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/** Sum kgCO2 from an array of activity objects. */
function sumKg(activities) {
  return activities.reduce((acc, a) => acc + (a.kgCO2 ?? 0), 0);
}

/**
 * Returns a date string 'YYYY-MM-DD' for grouping.
 * @param {string} isoTimestamp
 */
function dateKey(isoTimestamp) {
  return isoTimestamp.slice(0, 10);
}

/**
 * Groups activities by date, returning { 'YYYY-MM-DD': number } totals.
 * @param {Array} activities
 * @returns {Object}
 */
function groupByDate(activities) {
  return activities.reduce((acc, a) => {
    const key = dateKey(a.timestamp);
    acc[key] = (acc[key] ?? 0) + (a.kgCO2 ?? 0);
    return acc;
  }, {});
}

/**
 * Groups activities by category.
 * @param {Array} activities
 * @returns {Object} { category: totalKg }
 */
function groupByCategory(activities) {
  return activities.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + (a.kgCO2 ?? 0);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes comprehensive stats from stored activity data.
 * @returns {TrackerStats}
 */
export function computeStats() {
  const all        = storage.getActivities();
  const today      = storage.getTodayActivities();
  const week       = storage.getRecentActivities(7);
  const month      = storage.getRecentActivities(30);

  const todayKg    = sumKg(today);
  const weekKg     = sumKg(week);
  const monthKg    = sumKg(month);

  // Daily breakdown for last 30 days
  const dailyMap   = groupByDate(month);
  // Fill missing days with 0
  const days30     = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days30.push({ date: key, kg: parseFloat((dailyMap[key] ?? 0).toFixed(3)) });
  }

  const dailyValues = days30.map(d => d.kg).filter(v => v > 0);
  const avgDailyKg  = dailyValues.length
    ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
    : 0;

  const bestDayKg   = dailyValues.length ? Math.min(...dailyValues) : 0;
  const weekDays    = groupByDate(week);
  const bestWeekKg  = Math.min(...Object.values(weekDays).map(v => v)) || 0;

  const categoryBreakdown = groupByCategory(week);

  // Transport type counts
  const transportCounts = all
    .filter(a => a.category === 'transport')
    .reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {});

  // Streak
  const user = storage.getUser();
  const currentStreak = user.streak ?? 0;

  // Zero-emission days in last 30
  const zeroDays = days30.filter(d => d.kg === 0 && d.date < new Date().toISOString().slice(0, 10)).length;

  // Plant-based streak (consecutive days with only legumes/veg/fruit food)
  const plantBasedFoods = new Set(['vegetables', 'fruits', 'legumes', 'bread', 'rice']);
  let plantBasedStreak = 0;
  for (let i = days30.length - 1; i >= 0; i--) {
    const dayActivities = month.filter(a => dateKey(a.timestamp) === days30[i].date);
    const foodActs = dayActivities.filter(a => a.category === 'food');
    if (foodActs.length === 0) break;
    if (foodActs.every(a => plantBasedFoods.has(a.type))) {
      plantBasedStreak++;
    } else {
      break;
    }
  }

  return {
    todayKg:          parseFloat(todayKg.toFixed(3)),
    weekKg:           parseFloat(weekKg.toFixed(3)),
    monthKg:          parseFloat(monthKg.toFixed(3)),
    avgDailyKg:       parseFloat(avgDailyKg.toFixed(3)),
    bestDayKg,
    bestWeekKg,
    days30,
    categoryBreakdown,
    transportCounts,
    totalLogs:        all.length,
    currentStreak,
    zeroDays,
    plantBasedStreak,
    teamRank:         null, // set by social module
    equivalence:      getEquivalence(todayKg),
    emotionalContext: getEmotionalContext(todayKg),
    vsGlobalAvg:      GLOBAL_AVG_DAILY_KG,
    vsParisTarget:    PARIS_TARGET_DAILY,
    vsHeroTarget:     HERO_TARGET_DAILY,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// World Health Score
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps average daily kg CO₂ to a 0–100 health score (100 = pristine).
 * Curve: exponential decay so early reductions have big visual impact.
 * @param {number} avgDailyKg
 * @returns {number} health score 0–100
 */
export function computeWorldHealth(avgDailyKg) {
  if (avgDailyKg <= 0)  return 100;
  if (avgDailyKg >= 25) return 0;
  // Score = 100 * e^(-0.1 * avgDailyKg) roughly
  const raw = 100 * Math.exp(-0.095 * avgDailyKg);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Submission (combines calculation + storage + achievement check)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full pipeline: calculate → save → check achievements → return result.
 * @param {string} category
 * @param {string} type
 * @param {number} amount
 * @param {string} [note]
 * @returns {{ entry: object, nudge: object|null, newAchievements: string[] }}
 */
export function submitActivity(category, type, amount, note = '') {
  const kgCO2  = calculateEmission(category, type, amount);
  const factors = EMISSION_FACTORS[category];
  const label   = factors?.[type]?.label ?? type;

  const entry = storage.addActivity({ category, type, amount, kgCO2, note, label });

  // Nudge for transport
  let nudge = null;
  if (category === 'transport') {
    nudge = getTransportNudge(type, amount);
  }

  // Check achievements
  const stats          = computeStats();
  const unlocked       = storage.getUnlockedAchievements();
  const newAchievements = [];

  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.includes(ach.id) && ach.condition(stats)) {
      const isNew = storage.unlockAchievement(ach.id);
      if (isNew) newAchievements.push(ach);
    }
  }

  return { entry, nudge, newAchievements, kgCO2, stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick emission preview (no storage write)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Previews what submitting an activity would cost WITHOUT writing to storage.
 * Used for real-time UI feedback as user adjusts amount.
 * @param {string} category
 * @param {string} type
 * @param {number} amount
 * @returns {{ kgCO2: number, equivalence: string, context: object, nudge: object|null }}
 */
export function previewEmission(category, type, amount) {
  try {
    const kgCO2 = calculateEmission(category, type, amount);
    return {
      kgCO2,
      equivalence: getEquivalence(kgCO2),
      context:     getEmotionalContext(kgCO2),
      nudge:       category === 'transport' ? getTransportNudge(type, amount) : null,
    };
  } catch {
    return { kgCO2: 0, equivalence: '', context: null, nudge: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Last 7 days for chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns last-7-day daily totals array for chart rendering.
 * @returns {{ labels: string[], data: number[] }}
 */
export function getWeeklyChartData() {
  const week = storage.getRecentActivities(7);
  const map  = groupByDate(week);
  const labels = [], data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    labels.push(label);
    data.push(parseFloat((map[key] ?? 0).toFixed(3)));
  }

  return { labels, data };
}

/**
 * Returns category breakdown for pie/doughnut chart (last 7 days).
 * @returns {{ labels: string[], data: number[], colors: string[] }}
 */
export function getCategoryChartData() {
  const week      = storage.getRecentActivities(7);
  const breakdown = groupByCategory(week);

  const COLORS = {
    transport: '#ef4444',
    food:      '#f59e0b',
    energy:    '#fbbf24',
    shopping:  '#8b5cf6',
    travel:    '#3b82f6',
  };

  const LABELS = {
    transport: 'Transport',
    food:      'Food',
    energy:    'Energy',
    shopping:  'Shopping',
    travel:    'Travel',
  };

  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(([k]) => LABELS[k] ?? k),
    data:   entries.map(([, v]) => parseFloat(v.toFixed(3))),
    colors: entries.map(([k]) => COLORS[k] ?? '#64748b'),
  };
}
