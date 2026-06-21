/**
 * @module tracker
 * @description Core carbon footprint calculation engine.
 *
 *  Responsibilities:
 *  - Validates and computes kg CO₂e for logged activities
 *  - Aggregates daily / weekly / monthly totals from storage
 *  - Derives a "World Health Score" (0–100) for the Living World canvas
 *  - Generates context-aware nudges for high-emission transport choices
 *  - Checks and awards achievements after each activity submission
 *  - Provides linear-regression-based 30-day CO₂ forecasting
 *
 * @version 1.1.0
 */

import { storage } from './storage.js';
import {
  EMISSION_FACTORS,
  CATEGORIES,
  ACHIEVEMENTS,
  getEquivalence,
  getEmotionalContext,
  getTransportNudge,
  GLOBAL_AVG_DAILY_KG,
  PARIS_TARGET_DAILY,
  HERO_TARGET_DAILY,
} from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// JSDoc type definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DailyEntry
 * @property {string} date   - ISO date string 'YYYY-MM-DD'
 * @property {number} kg     - total kg CO₂e for that day
 */

/**
 * @typedef {Object} TrackerStats
 * @property {number}   todayKg            - total CO₂e logged today
 * @property {number}   weekKg             - total CO₂e last 7 days
 * @property {number}   monthKg            - total CO₂e last 30 days
 * @property {number}   avgDailyKg         - mean daily CO₂e over active days
 * @property {number}   bestDayKg          - lowest single-day total recorded
 * @property {number}   bestWeekKg         - lowest single-day total in last 7 days
 * @property {DailyEntry[]} days30         - last 30 daily entries (including zero days)
 * @property {Object}   categoryBreakdown  - { category: kgTotal } for last 7 days
 * @property {Object}   transportCounts    - { transportType: count } for all time
 * @property {number}   totalLogs          - total activity count all time
 * @property {number}   currentStreak      - consecutive logging days
 * @property {number}   zeroDays           - days with 0 emissions in last 30
 * @property {number}   plantBasedStreak   - consecutive plant-based food days
 * @property {string|null} teamRank        - set externally by social module
 * @property {string}   equivalence        - human-readable today equivalence string
 * @property {Object}   emotionalContext   - { label, color, emoji, tier }
 * @property {number}   vsGlobalAvg        - global average reference (kg/day)
 * @property {number}   vsParisTarget      - Paris target reference (kg/day)
 * @property {number}   vsHeroTarget       - hero target reference (kg/day)
 * @property {ForecastResult} forecast     - 30-day CO₂ projection
 * @property {number}   budgetRemaining    - kg CO₂ remaining in monthly budget
 * @property {number}   budgetDaysLeft     - calendar days left in current month
 */

/**
 * @typedef {Object} ForecastResult
 * @property {number}   projectedMonthlyKg - predicted total CO₂ for current month
 * @property {number}   projectedDailyAvg  - predicted daily average for rest of month
 * @property {'on_track'|'at_risk'|'over_budget'} status - budget status
 * @property {number}   trendSlope         - regression slope (kg/day change per day)
 * @property {boolean}  improving          - true if slope is negative
 */

/**
 * @typedef {Object} ActivityPreview
 * @property {number}      kgCO2       - calculated emission
 * @property {string}      equivalence - human-readable context string
 * @property {Object|null} context     - emotional context object
 * @property {Object|null} nudge       - transport nudge or null
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of activities retained in storage. */
const MAX_ACTIVITIES = 1000;

/** Number of days in the rolling stats window. */
const STATS_WINDOW_DAYS = 30;

/** Plant-based food types for streak calculation. */
const PLANT_BASED_TYPES = new Set(['vegetables', 'fruits', 'legumes', 'bread', 'rice']);

// ─────────────────────────────────────────────────────────────────────────────
// Calculation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the kg CO₂e for a given activity entry.
 *
 * @param {string} category - emission category key (e.g. 'transport')
 * @param {string} type     - activity type key within category (e.g. 'car_petrol')
 * @param {number} amount   - quantity in the activity's native unit (km, servings, kWh…)
 * @returns {number} kg CO₂e rounded to 4 decimal places
 * @throws {Error} if category or type is unknown, or amount is invalid
 */
export function calculateEmission(category, type, amount) {
  const factors = EMISSION_FACTORS[category];
  if (!factors) {
    throw new Error(`Unknown emission category: "${category}". Valid categories: ${Object.keys(EMISSION_FACTORS).join(', ')}`);
  }

  const entry = factors[type];
  if (!entry) {
    throw new Error(`Unknown activity type: "${type}" in category "${category}". Valid types: ${Object.keys(factors).join(', ')}`);
  }

  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid amount: "${amount}". Must be a non-negative finite number.`);
  }

  return parseFloat((entry.factor * num).toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────────
// Private aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sums the kgCO2 field from an array of activity records.
 *
 * @param {Object[]} activities - activity records with a kgCO2 number field
 * @returns {number} total kg CO₂e
 */
function sumKg(activities) {
  return activities.reduce((acc, a) => acc + (a.kgCO2 ?? 0), 0);
}

/**
 * Extracts the 'YYYY-MM-DD' date portion of an ISO timestamp string.
 *
 * @param {string} isoTimestamp - ISO 8601 timestamp string
 * @returns {string} date portion
 */
function dateKey(isoTimestamp) {
  return isoTimestamp.slice(0, 10);
}

/**
 * Groups activities by calendar date, summing kg CO₂e per day.
 *
 * @param {Object[]} activities - activity records with timestamp and kgCO2
 * @returns {Object.<string, number>} map of 'YYYY-MM-DD' → total kg CO₂e
 */
function groupByDate(activities) {
  return activities.reduce((acc, a) => {
    const key = dateKey(a.timestamp);
    acc[key] = (acc[key] ?? 0) + (a.kgCO2 ?? 0);
    return acc;
  }, {});
}

/**
 * Groups activities by emission category, summing kg CO₂e per category.
 *
 * @param {Object[]} activities - activity records with category and kgCO2
 * @returns {Object.<string, number>} map of category → total kg CO₂e
 */
function groupByCategory(activities) {
  return activities.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + (a.kgCO2 ?? 0);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Linear regression forecasting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a simple linear regression (ordinary least squares) over daily
 * emission data to project the current month's total CO₂ output.
 *
 * The regression finds slope (m) and intercept (b) for y = m·x + b where
 * x = day index and y = daily kg CO₂. This allows detecting improving or
 * worsening trends and projecting remaining days.
 *
 * @param {DailyEntry[]} days30          - last 30 daily entries (x=0 oldest)
 * @param {number}       monthlyBudgetKg - user's monthly CO₂ budget
 * @returns {ForecastResult}
 */
function computeForecast(days30, monthlyBudgetKg) {
  // Only use days that have actual data for regression
  const activeDays = days30
    .map((d, idx) => ({ x: idx, y: d.kg }))
    .filter(p => p.y > 0);

  const n = activeDays.length;

  let slope = 0;
  let intercept = 0;

  if (n >= 2) {
    // OLS: slope = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
    const sumX  = activeDays.reduce((s, p) => s + p.x, 0);
    const sumY  = activeDays.reduce((s, p) => s + p.y, 0);
    const sumXY = activeDays.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = activeDays.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;

    if (denom !== 0) {
      slope     = (n * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / n;
    }
  }

  // How many days into the current month are we?
  const now = new Date();
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft     = daysInMonth - dayOfMonth;

  // Accumulated so far this month
  const daysThisMonth = days30.slice(Math.max(0, 30 - dayOfMonth));
  const accumulatedKg = daysThisMonth.reduce((s, d) => s + d.kg, 0);

  // Predict remaining days using avg of last 7 active days (more stable than regression alone)
  const last7Active  = activeDays.slice(-7);
  const predictedAvg = last7Active.length > 0
    ? last7Active.reduce((s, p) => s + p.y, 0) / last7Active.length
    : (intercept + slope * 29); // fallback to regression at day 29

  const projectedRemaining = Math.max(0, predictedAvg * daysLeft);
  const projectedMonthlyKg = parseFloat((accumulatedKg + projectedRemaining).toFixed(2));

  let status;
  if (projectedMonthlyKg <= monthlyBudgetKg * 0.9)  { status = 'on_track'; }
  else if (projectedMonthlyKg <= monthlyBudgetKg)   { status = 'at_risk'; }
  else                                               { status = 'over_budget'; }

  return {
    projectedMonthlyKg,
    projectedDailyAvg: parseFloat(predictedAvg.toFixed(3)),
    status,
    trendSlope:        parseFloat(slope.toFixed(4)),
    improving:         slope < 0,
    daysLeft,
    accumulatedKg:     parseFloat(accumulatedKg.toFixed(3)),
    budgetKg:          monthlyBudgetKg,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a comprehensive statistics snapshot from all stored activity data.
 *
 * This is the primary data source for the dashboard, Living World, charts,
 * and insights features. Results are deterministic for a given storage state.
 *
 * @returns {TrackerStats} complete statistics object
 */
export function computeStats() {
  const all   = storage.getActivities();
  const today = storage.getTodayActivities();
  const week  = storage.getRecentActivities(7);
  const month = storage.getRecentActivities(STATS_WINDOW_DAYS);

  const todayKg = sumKg(today);
  const weekKg  = sumKg(week);
  const monthKg = sumKg(month);

  // Build a complete 30-day daily map (fills missing days with 0)
  const dailyMap = groupByDate(month);
  const todayStr = new Date().toISOString().slice(0, 10);

  /** @type {DailyEntry[]} */
  const days30 = [];
  for (let i = STATS_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days30.push({ date: key, kg: parseFloat((dailyMap[key] ?? 0).toFixed(3)) });
  }

  // Average over days that have at least some data
  const activeDailyValues = days30.map(d => d.kg).filter(v => v > 0);
  const avgDailyKg = activeDailyValues.length
    ? activeDailyValues.reduce((a, b) => a + b, 0) / activeDailyValues.length
    : 0;

  // Best (lowest non-zero) day
  const bestDayKg = activeDailyValues.length ? Math.min(...activeDailyValues) : 0;

  // Best day within the past 7 specifically
  const weekDailyValues = days30.slice(-7).map(d => d.kg).filter(v => v > 0);
  const bestWeekKg = weekDailyValues.length ? Math.min(...weekDailyValues) : 0;

  const categoryBreakdown = groupByCategory(week);

  // Transport mode counts (all time)
  const transportCounts = all
    .filter(a => a.category === 'transport')
    .reduce((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {});

  const user          = storage.getUser();
  const currentStreak = user.streak ?? 0;

  // Zero-emission days in last 30 (excluding today if no logs yet)
  const zeroDays = days30.filter(d => d.kg === 0 && d.date < todayStr).length;

  // Consecutive plant-based food days
  let plantBasedStreak = 0;
  for (let i = days30.length - 1; i >= 0; i--) {
    const dayActivities = month.filter(a => dateKey(a.timestamp) === days30[i].date);
    const foodActs      = dayActivities.filter(a => a.category === 'food');
    if (foodActs.length === 0) { break; }
    if (foodActs.every(a => PLANT_BASED_TYPES.has(a.type))) {
      plantBasedStreak++;
    } else {
      break;
    }
  }

  // Budget calculations
  const settings        = storage.getSettings();
  const monthlyBudget   = (settings.dailyTarget ?? PARIS_TARGET_DAILY) * 30;
  const forecast        = computeForecast(days30, monthlyBudget);
  const budgetRemaining = Math.max(0, parseFloat((monthlyBudget - monthKg).toFixed(3)));

  const now           = new Date();
  const budgetDaysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

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
    teamRank:         null,       // populated externally by social module
    equivalence:      getEquivalence(todayKg),
    emotionalContext: getEmotionalContext(todayKg),
    vsGlobalAvg:      GLOBAL_AVG_DAILY_KG,
    vsParisTarget:    PARIS_TARGET_DAILY,
    vsHeroTarget:     HERO_TARGET_DAILY,
    forecast,
    budgetRemaining,
    budgetDaysLeft,
    monthlyBudget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// World Health Score
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a 30-day average daily kg CO₂e value to a 0–100 planet health score.
 *
 * Uses exponential decay so early reductions have a large visual impact on
 * the Living World canvas, motivating users to act quickly.
 *
 * Curve: score = 100 · e^(−0.095 · avgDailyKg), clamped to [0, 100].
 *
 * @param {number} avgDailyKg - 30-day average daily CO₂ emissions
 * @returns {number} integer health score in range [0, 100]
 */
export function computeWorldHealth(avgDailyKg) {
  if (!Number.isFinite(avgDailyKg) || avgDailyKg <= 0) { return 100; }
  if (avgDailyKg >= 25) { return 0; }
  const raw = 100 * Math.exp(-0.095 * avgDailyKg);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Submission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full activity pipeline: validate → calculate → persist → award achievements.
 *
 * This is the single entry point for all user-initiated activity logging.
 * Keeps side effects (storage writes, achievement unlocks) in one place.
 *
 * @param {string} category - emission category key
 * @param {string} type     - activity type key within category
 * @param {number} amount   - quantity in the activity's native unit
 * @param {string} [note]   - optional user note (max 120 chars, sanitised)
 * @returns {{ entry: Object, nudge: Object|null, newAchievements: Object[], kgCO2: number, stats: TrackerStats }}
 * @throws {Error} if category, type, or amount is invalid
 */
export function submitActivity(category, type, amount, note = '') {
  const kgCO2  = calculateEmission(category, type, amount);
  const label  = EMISSION_FACTORS[category]?.[type]?.label ?? type;

  const entry  = storage.addActivity({ category, type, amount, kgCO2, note, label });

  // Transport nudge — only relevant for motorised modes
  const nudge  = category === 'transport' ? getTransportNudge(type, amount) : null;

  // Achievement evaluation
  const stats           = computeStats();
  const unlocked        = storage.getUnlockedAchievements();
  const newAchievements = [];

  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.includes(ach.id) && ach.condition(stats)) {
      const isNew = storage.unlockAchievement(ach.id);
      if (isNew) { newAchievements.push(ach); }
    }
  }

  return { entry, nudge, newAchievements, kgCO2, stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Emission Preview (read-only — does NOT write to storage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Previews the emission impact of a potential activity WITHOUT writing
 * any data to storage. Used for real-time UI feedback as the user adjusts
 * form fields.
 *
 * Always returns a valid result object — never throws to the caller.
 *
 * @param {string} category - emission category key
 * @param {string} type     - activity type key
 * @param {number} amount   - quantity (may be 0 or NaN during user input)
 * @returns {ActivityPreview}
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
// Chart data helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns daily totals for the last 7 days, ready for the weekly bar chart.
 *
 * @returns {{ labels: string[], data: number[] }}
 */
export function getWeeklyChartData() {
  const week = storage.getRecentActivities(7);
  const map  = groupByDate(week);

  const labels = [];
  const data   = [];

  for (let i = 6; i >= 0; i--) {
    const d     = new Date();
    d.setDate(d.getDate() - i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    labels.push(label);
    data.push(parseFloat((map[key] ?? 0).toFixed(3)));
  }

  return { labels, data };
}

/**
 * Returns category breakdown for the last 7 days, ready for a doughnut chart.
 * Uses colour and label metadata from the CATEGORIES constant in data.js.
 *
 * @returns {{ labels: string[], data: number[], colors: string[] }}
 */
export function getCategoryChartData() {
  const week      = storage.getRecentActivities(7);
  const breakdown = groupByCategory(week);

  const entries = Object.entries(breakdown).sort(([, a], [, b]) => b - a);

  return {
    labels: entries.map(([k]) => CATEGORIES[k]?.label ?? k),
    data:   entries.map(([, v]) => parseFloat(v.toFixed(3))),
    colors: entries.map(([k]) => CATEGORIES[k]?.color ?? '#64748b'),
  };
}

/**
 * Returns the last 30-day daily entries for heatmap rendering.
 * Exported for use in charts.js heatmap component.
 *
 * @returns {DailyEntry[]}
 */
export function getHeatmapData() {
  const stats = computeStats();
  return stats.days30;
}
