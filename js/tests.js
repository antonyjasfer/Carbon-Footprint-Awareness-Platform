/**
 * @module tests
 * @description Browser-native unit test suite for the Carbon Footprint Awareness Platform.
 *
 *  No external test runner required — runs entirely in the browser.
 *
 *  Coverage areas:
 *  - Emission calculation (all 5 categories, edge cases, boundary values)
 *  - Input validation and error handling
 *  - World Health Score mapping
 *  - Transport nudge generation
 *  - Equivalence and emotional context classification
 *  - Storage persistence, sanitisation, and schema validation
 *  - Linear regression forecasting
 *  - Data integrity (all EMISSION_FACTORS entries have required fields)
 *  - Category chart data integrity
 *  - Full integration pipeline (log → stats → health → forecast)
 *
 * @version 1.1.0
 * @see Usage: import and call runAllTests(), or click "Run Unit Tests" in the Goals section.
 */

import {
  calculateEmission,
  computeWorldHealth,
  previewEmission,
  getCategoryChartData,
  getWeeklyChartData,
  getHeatmapData,
  computeStats,
} from './tracker.js';

import {
  getTransportNudge,
  getEquivalence,
  getEmotionalContext,
  EMISSION_FACTORS,
  CATEGORIES,
} from './data.js';

import { storage } from './storage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Micro test runner
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
/** @type {Array<{status:string, suite:string, label:string, detail:string}>} */
const _results = [];
let _currentSuite = 'General';

/**
 * Sets the active suite name for subsequent assertions.
 * @param {string} name - suite display name
 */
function suite(name) {
  _currentSuite = name;
}

/**
 * Asserts a boolean condition and records a PASS or FAIL result.
 *
 * @param {string}  label     - human-readable description of the assertion
 * @param {boolean} condition - the condition being tested
 * @param {string}  [detail]  - optional extra context shown on failure
 */
function assert(label, condition, detail = '') {
  if (condition) {
    _passed++;
    _results.push({ status: 'PASS', suite: _currentSuite, label, detail });
  } else {
    _failed++;
    _results.push({ status: 'FAIL', suite: _currentSuite, label, detail });
    console.error(`[TEST FAIL] ${_currentSuite} → ${label}${detail ? ' — ' + detail : ''}`);
  }
}

/**
 * Asserts that two numbers are within a given tolerance.
 *
 * @param {string} label    - assertion label
 * @param {number} actual   - computed value
 * @param {number} expected - expected value
 * @param {number} [tol]    - absolute tolerance (default 0.001)
 */
function assertClose(label, actual, expected, tol = 0.001) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= tol;
  assert(label, ok, `expected ~${expected}, got ${actual}`);
}

/**
 * Asserts that invoking fn throws any error.
 *
 * @param {string}   label - assertion label
 * @param {Function} fn    - function expected to throw
 */
function assertThrows(label, fn) {
  try {
    fn();
    assert(label, false, 'Expected an error to be thrown but none was');
  } catch {
    assert(label, true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Emission Calculations
// ─────────────────────────────────────────────────────────────────────────────

function testEmissionCalculations() {
  suite('Emission Calculations');

  // Transport
  assertClose('Car petrol 10km → 2.1 kg',            calculateEmission('transport', 'car_petrol', 10),      2.1);
  assertClose('Car diesel 10km → 1.7 kg',             calculateEmission('transport', 'car_diesel', 10),      1.7);
  assertClose('Car electric 10km → 0.5 kg',           calculateEmission('transport', 'car_electric', 10),   0.5);
  assertClose('Metro 10km → 0.41 kg',                 calculateEmission('transport', 'metro', 10),          0.41);
  assertClose('Bus 10km → 0.89 kg',                   calculateEmission('transport', 'bus', 10),            0.89);
  assertClose('Bicycle 20km → 0 kg',                  calculateEmission('transport', 'bicycle', 20),        0);
  assertClose('Walking 5km → 0 kg',                   calculateEmission('transport', 'walking', 5),         0);
  assertClose('Auto rickshaw 10km → 0.92 kg',         calculateEmission('transport', 'auto_rickshaw', 10),  0.92);
  assertClose('Shared cab 10km → 1.06 kg',            calculateEmission('transport', 'cab_shared', 10),     1.06);

  // Travel
  assertClose('Domestic flight 1000km → 255 kg',     calculateEmission('travel', 'flight_domestic', 1000),  255);
  assertClose('International flight 5000km → 975 kg',calculateEmission('travel', 'flight_intl', 5000),      975);
  assertClose('Long train 100km → 4.1 kg',            calculateEmission('travel', 'train_long', 100),        4.1);
  assertClose('Hotel 2 nights → 63 kg',               calculateEmission('travel', 'hotel_night', 2),         63);
  assertClose('Cruise 3 days → 480 kg',               calculateEmission('travel', 'cruise_day', 3),         480);

  // Food
  assertClose('Beef 1 serving → 27 kg',              calculateEmission('food', 'beef', 1),               27);
  assertClose('Pork 1 serving → 12 kg',              calculateEmission('food', 'pork', 1),               12);
  assertClose('Chicken 1 serving → 6.9 kg',          calculateEmission('food', 'chicken', 1),            6.9);
  assertClose('Vegetables 1 serving → 2 kg',         calculateEmission('food', 'vegetables', 1),         2);
  assertClose('Legumes 1 serving → 0.9 kg',          calculateEmission('food', 'legumes', 1),            0.9);
  assertClose('Coffee 2 cups → 4.2 kg',              calculateEmission('food', 'coffee', 2),             4.2);
  assertClose('Delivery order → 4.2 kg',             calculateEmission('food', 'delivery_meal', 1),      4.2);

  // Energy
  assertClose('Electricity 10kWh → 8.2 kg',          calculateEmission('energy', 'electricity', 10),     8.2);
  assertClose('AC 3 hours → 2.7 kg',                 calculateEmission('energy', 'ac_hour', 3),          2.7);
  assertClose('Heater 2 hours → 1.4 kg',             calculateEmission('energy', 'heater_hour', 2),      1.4);
  assertClose('Natural gas 1m³ → 2.04 kg',           calculateEmission('energy', 'natural_gas', 1),      2.04);
  assertClose('LPG 1L → 1.51 kg',                    calculateEmission('energy', 'lpg', 1),              1.51);

  // Shopping
  assertClose('Clothing item → 8 kg',                calculateEmission('shopping', 'clothing_new', 1),   8);
  assertClose('Laptop → 300 kg',                     calculateEmission('shopping', 'laptop', 1),         300);
  assertClose('Shoes → 14 kg',                       calculateEmission('shopping', 'shoes', 1),          14);
  assertClose('Smartphone → 70 kg',                  calculateEmission('shopping', 'smartphone', 1),     70);
  assertClose('Online package → 0.5 kg',             calculateEmission('shopping', 'online_delivery', 1), 0.5);
  assertClose('Plastic bottle → 0.08 kg',            calculateEmission('shopping', 'plastic_bottle', 1), 0.08);

  // Boundary values
  assertClose('Zero amount always → 0 kg',           calculateEmission('transport', 'car_petrol', 0),    0);
  assertClose('Very large amount scales correctly',  calculateEmission('food', 'beef', 100),              2700, 0.01);
  assertClose('Fractional amount works',             calculateEmission('energy', 'electricity', 0.5),    0.41);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Input Validation & Error Handling
// ─────────────────────────────────────────────────────────────────────────────

function testInputValidation() {
  suite('Input Validation & Error Handling');

  // Invalid category / type
  assertThrows('Unknown category throws',          () => calculateEmission('aliens', 'ufo', 10));
  assertThrows('Unknown type throws',              () => calculateEmission('transport', 'rocket', 100));
  assertThrows('Empty category throws',            () => calculateEmission('', 'car_petrol', 10));
  assertThrows('Empty type throws',                () => calculateEmission('transport', '', 10));

  // Invalid amounts
  assertThrows('Negative amount throws',           () => calculateEmission('transport', 'car_petrol', -5));
  assertThrows('NaN amount throws',                () => calculateEmission('transport', 'car_petrol', NaN));
  assertThrows('Infinity amount throws',           () => calculateEmission('transport', 'car_petrol', Infinity));
  assertThrows('-Infinity amount throws',          () => calculateEmission('transport', 'car_petrol', -Infinity));

  // Storage validation
  assertThrows('Null activity throws',             () => storage.addActivity(null));
  assertThrows('Undefined activity throws',        () => storage.addActivity(undefined));
  assertThrows('Missing kgCO2 field throws',       () => storage.addActivity({ category: 'food', type: 'beef', amount: 1 }));
  assertThrows('Negative kgCO2 throws',            () => storage.addActivity({ category: 'food', type: 'beef', amount: 1, kgCO2: -1 }));
  assertThrows('NaN kgCO2 throws',                 () => storage.addActivity({ category: 'food', type: 'beef', amount: 1, kgCO2: NaN }));

  // previewEmission must never throw — it returns a safe default
  const p1 = previewEmission('invalid', 'invalid', NaN);
  assert('previewEmission bad category → kgCO2:0',  p1.kgCO2 === 0);
  assert('previewEmission bad input → no nudge',    p1.nudge === null);
  assert('previewEmission bad input → no context',  p1.context === null);

  const p2 = previewEmission('transport', 'car_petrol', 0);
  assert('previewEmission zero amount → kgCO2:0',   p2.kgCO2 === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: World Health Score
// ─────────────────────────────────────────────────────────────────────────────

function testWorldHealth() {
  suite('World Health Score');

  assert('0 kg/day → 100',              computeWorldHealth(0)    === 100);
  assert('25+ kg/day → 0',             computeWorldHealth(25)   === 0);
  assert('30 kg/day → 0 (clamped)',    computeWorldHealth(30)   === 0);
  assert('-1 kg/day → 100 (clamped)', computeWorldHealth(-1)   === 100);
  assert('NaN → 100 (safe fallback)',  computeWorldHealth(NaN)  === 100);
  assert('Paris target (6.3) ≥ 50',   computeWorldHealth(6.3)  >= 50);
  assert('Global avg (12) > 0',        computeWorldHealth(12)   > 0);
  assert('Result is always integer',   Number.isInteger(computeWorldHealth(7.5)));
  assert('Result stays in [0, 100]',   computeWorldHealth(12)   >= 0 && computeWorldHealth(12) <= 100);
  assert('Higher emissions → lower',   computeWorldHealth(5)    > computeWorldHealth(15));
  assert('Monotonically decreasing',   computeWorldHealth(3) > computeWorldHealth(6)
    && computeWorldHealth(6) > computeWorldHealth(12)
    && computeWorldHealth(12) > computeWorldHealth(20));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Transport Nudges
// ─────────────────────────────────────────────────────────────────────────────

function testNudges() {
  suite('Transport Nudges');

  const carNudge = getTransportNudge('car_petrol', 10);
  assert('Car petrol nudge exists',              carNudge !== null);
  assert('Car nudge savings > 0',               carNudge?.savings > 0);
  assert('Car nudge has altLabel string',       typeof carNudge?.altLabel === 'string');
  assert('Car nudge ratio > 1',                 carNudge?.ratio > 1);
  assert('Car nudge message is non-empty',      typeof carNudge?.message === 'string' && carNudge.message.length > 0);

  const motoNudge = getTransportNudge('motorcycle', 15);
  assert('Motorcycle nudge exists',             motoNudge !== null);
  assert('Motorcycle nudge has alternative',    motoNudge?.alternative !== undefined);

  // Green modes should produce no nudge
  assert('Metro nudge is null',                 getTransportNudge('metro', 10)      === null);
  assert('Bicycle nudge is null',               getTransportNudge('bicycle', 10)    === null);
  assert('Walking nudge is null',               getTransportNudge('walking', 5)     === null);

  // Zero / invalid distance
  assert('Zero distance → null',               getTransportNudge('car_petrol', 0)  === null);

  // Already-green categories don't get nudges
  assert('Food category → null nudge',          getTransportNudge('food', 10)       === null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Equivalences & Emotional Context
// ─────────────────────────────────────────────────────────────────────────────

function testEquivalencesAndContext() {
  suite('Equivalences & Emotional Context');

  const eq0 = getEquivalence(0);
  assert('Zero kg → zero/perfect message',      eq0.includes('zero') || eq0.includes('perfect'));

  const eq5  = getEquivalence(5);
  const eq50 = getEquivalence(50);
  assert('Non-zero → non-empty string',         typeof eq5  === 'string' && eq5.length  > 0);
  assert('Large value → non-empty string',      typeof eq50 === 'string' && eq50.length > 0);

  // Emotional context tiers
  assert('0 kg → hero tier',                   getEmotionalContext(0).tier    === 'hero');
  assert('1 kg → hero tier',                   getEmotionalContext(1).tier    === 'hero');
  assert('2 kg → good tier',                   getEmotionalContext(2).tier    === 'good');
  assert('5 kg → good tier',                   getEmotionalContext(5).tier    === 'good');
  assert('8 kg → average tier',                getEmotionalContext(8).tier    === 'average');
  assert('12 kg → warn tier',                  getEmotionalContext(12).tier   === 'warn');
  assert('20 kg → critical tier',              getEmotionalContext(20).tier   === 'critical');
  assert('100 kg → critical tier',             getEmotionalContext(100).tier  === 'critical');

  // Context object shape
  const ctx = getEmotionalContext(5);
  assert('Context has label',                   typeof ctx.label === 'string' && ctx.label.length > 0);
  assert('Context has hex color',               typeof ctx.color === 'string' && ctx.color.startsWith('#'));
  assert('Context has emoji',                   typeof ctx.emoji === 'string' && ctx.emoji.length > 0);
  assert('Context has tier',                    typeof ctx.tier  === 'string' && ctx.tier.length  > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Storage — Persistence, Validation & Sanitisation
// ─────────────────────────────────────────────────────────────────────────────

function testStorage() {
  suite('Storage — Persistence, Validation & Sanitisation');

  // Persistence: adding an activity increases count
  const countBefore = storage.getActivities().length;
  const added = storage.addActivity({
    category: 'food', type: 'vegetables', amount: 1, kgCO2: 2.0, note: 'test entry',
  });
  const countAfter = storage.getActivities().length;
  assert('Activity count increments after add',  countAfter === countBefore + 1);
  assert('Saved entry has a UUID id',            typeof added.id === 'string' && added.id.length > 0);
  assert('Saved entry has ISO timestamp',        typeof added.timestamp === 'string' && added.timestamp.includes('T'));
  assert('Saved kgCO2 matches',                  added.kgCO2 === 2.0);
  assert('Saved category matches',               added.category === 'food');

  // XSS sanitisation in user name
  storage.saveUser({ name: '<script>alert("xss")</script>' });
  const userAfterXss = storage.getUser();
  assert('XSS in name is stripped',             !userAfterXss.name.includes('<script>'));
  assert('XSS in name is entity-encoded',       userAfterXss.name.includes('&lt;script&gt;'));

  // XSS sanitisation in note field
  const xssEntry = storage.addActivity({
    category: 'transport', type: 'bus', amount: 10, kgCO2: 0.89,
    note: '<img src=x onerror=alert(1)>',
  });
  assert('XSS in note is sanitised',            !xssEntry.note.includes('<img'));

  // Reset name
  storage.saveUser({ name: 'You' });

  // Settings whitelist: unknown key should be ignored
  const before = storage.getSettings();
  storage.saveSettings({ unknownField: 'hacked', dailyTarget: 5.0 });
  const after = storage.getSettings();
  assert('Unknown settings field ignored',      after.unknownField === undefined);
  assert('Known settings field saved',          after.dailyTarget === 5.0);

  // Restore
  storage.saveSettings({ dailyTarget: before.dailyTarget });

  // getRecentActivities returns an array
  const recent = storage.getRecentActivities(7);
  assert('getRecentActivities returns array',   Array.isArray(recent));

  // getTodayActivities returns a subset of getActivities
  const todayActs = storage.getTodayActivities();
  assert('getTodayActivities returns array',    Array.isArray(todayActs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7: Data Integrity (EMISSION_FACTORS schema validation)
// ─────────────────────────────────────────────────────────────────────────────

function testDataIntegrity() {
  suite('Data Integrity — EMISSION_FACTORS schema');

  const REQUIRED_FIELDS = ['factor', 'unit', 'label', 'icon', 'color'];

  let totalTypes = 0;

  for (const [cat, types] of Object.entries(EMISSION_FACTORS)) {
    assert(`Category "${cat}" exists in CATEGORIES`,
      cat in CATEGORIES || cat === 'travel'); // travel is valid, maps to CATEGORIES

    for (const [typeKey, entry] of Object.entries(types)) {
      totalTypes++;
      for (const field of REQUIRED_FIELDS) {
        assert(
          `[${cat}.${typeKey}] has "${field}"`,
          entry[field] !== undefined && entry[field] !== null,
          `Missing field: ${field}`,
        );
      }
      assert(
        `[${cat}.${typeKey}] factor ≥ 0`,
        typeof entry.factor === 'number' && entry.factor >= 0,
        `factor=${entry.factor}`,
      );
      assert(
        `[${cat}.${typeKey}] unit is non-empty string`,
        typeof entry.unit === 'string' && entry.unit.length > 0,
      );
    }
  }

  assert('Total emission types ≥ 30', totalTypes >= 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 8: Chart Data Integrity
// ─────────────────────────────────────────────────────────────────────────────

function testChartData() {
  suite('Chart Data Integrity');

  const weekly = getWeeklyChartData();
  assert('Weekly chart has 7 labels',            weekly.labels.length === 7);
  assert('Weekly chart has 7 data points',       weekly.data.length   === 7);
  assert('Weekly chart values are ≥ 0',          weekly.data.every(v => v >= 0));
  assert('Weekly chart labels are strings',      weekly.labels.every(l => typeof l === 'string'));

  const category = getCategoryChartData();
  assert('Category chart labels is array',       Array.isArray(category.labels));
  assert('Category chart data is array',         Array.isArray(category.data));
  assert('Category chart colors is array',       Array.isArray(category.colors));
  assert('Category chart arrays same length',    category.labels.length === category.data.length
    && category.data.length === category.colors.length);
  assert('Category chart colors are hex strings',
    category.colors.every(c => typeof c === 'string' && c.startsWith('#')));

  const heatmap = getHeatmapData();
  assert('Heatmap returns 30 entries',           heatmap.length === 30);
  assert('Heatmap entries have date and kg',     heatmap.every(d => d.date && d.kg >= 0));
  assert('Heatmap dates are in order',           heatmap[0].date < heatmap[29].date);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 9: Forecasting (Linear Regression)
// ─────────────────────────────────────────────────────────────────────────────

function testForecasting() {
  suite('Forecasting');

  const stats = computeStats();
  const { forecast } = stats;

  assert('forecast object exists',                   forecast !== null && typeof forecast === 'object');
  assert('projectedMonthlyKg is a number',          typeof forecast.projectedMonthlyKg === 'number');
  assert('projectedMonthlyKg is finite',            Number.isFinite(forecast.projectedMonthlyKg));
  assert('projectedMonthlyKg ≥ 0',                  forecast.projectedMonthlyKg >= 0);
  assert('projectedDailyAvg ≥ 0',                   forecast.projectedDailyAvg >= 0);
  assert('status is a valid enum value',            ['on_track', 'at_risk', 'over_budget'].includes(forecast.status));
  assert('trendSlope is finite',                    Number.isFinite(forecast.trendSlope));
  assert('improving is boolean',                    typeof forecast.improving === 'boolean');
  assert('daysLeft is integer in [0, 31]',          Number.isInteger(forecast.daysLeft) && forecast.daysLeft >= 0 && forecast.daysLeft <= 31);
  assert('accumulatedKg ≥ 0',                       forecast.accumulatedKg >= 0);
  assert('budgetKg > 0',                            forecast.budgetKg > 0);
  assert('budgetRemaining is non-negative',         stats.budgetRemaining >= 0);
  assert('budgetDaysLeft in [0, 31]',               stats.budgetDaysLeft >= 0 && stats.budgetDaysLeft <= 31);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 10: Full Integration Pipeline
// ─────────────────────────────────────────────────────────────────────────────

function testIntegrationPipeline() {
  suite('Integration Pipeline');

  // Log an activity and verify the entire downstream state updates
  const before       = computeStats();
  const beforeTotal  = before.totalLogs;
  const beforeTodayKg = before.todayKg;

  const AMOUNT = 5; // 5 km
  const expectedKg = parseFloat((0.21 * AMOUNT).toFixed(4)); // car_petrol factor

  // Submit an activity
  const { kgCO2, stats: afterStats } = (function () {
    const { submitActivity } = window.__ecoTrackModules ?? {};
    if (!submitActivity) {
      // Direct import path – use tracker directly
      const kgCO2 = calculateEmission('transport', 'car_petrol', AMOUNT);
      storage.addActivity({ category: 'transport', type: 'car_petrol', amount: AMOUNT, kgCO2, note: '' });
      const stats = computeStats();
      return { entry: { kgCO2 }, kgCO2, stats };
    }
    return submitActivity('transport', 'car_petrol', AMOUNT, 'integration test');
  })();

  assert('Emission calculated correctly',            Math.abs(kgCO2 - expectedKg) <= 0.001);
  assert('Total logs increased by 1',               afterStats.totalLogs === beforeTotal + 1);
  assert('Today kg increased',                      afterStats.todayKg >= beforeTodayKg);
  assert('World health is computable after log',    computeWorldHealth(afterStats.avgDailyKg) >= 0);
  assert('Forecast updates after new log',          afterStats.forecast !== null);
  assert('Heatmap data length stays 30',            afterStats.days30.length === 30);

  // The current day entry in days30 should reflect added emission
  const todayEntry = afterStats.days30[afterStats.days30.length - 1];
  assert('Today heatmap entry kg > 0',              todayEntry.kg >= kgCO2 - 0.01);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all test suites sequentially and returns a complete summary report.
 * Errors within individual suites are caught and reported without aborting others.
 *
 * @returns {{ passed: number, failed: number, total: number, results: Array, passRate: number }}
 */
export function runAllTests() {
  _passed = 0;
  _failed = 0;
  _results.length = 0;
  _currentSuite = 'General';

  console.group('🧪 EcoTrack — Unit Test Suite v1.1.0');

  const suites = [
    ['Emission Calculations',       testEmissionCalculations],
    ['Input Validation',            testInputValidation],
    ['World Health Score',          testWorldHealth],
    ['Transport Nudges',            testNudges],
    ['Equivalences & Context',      testEquivalencesAndContext],
    ['Storage',                     testStorage],
    ['Data Integrity',              testDataIntegrity],
    ['Chart Data',                  testChartData],
    ['Forecasting',                 testForecasting],
    ['Integration Pipeline',        testIntegrationPipeline],
  ];

  for (const [name, fn] of suites) {
    try {
      fn();
    } catch (err) {
      console.error(`[TEST SUITE ERROR] ${name}:`, err);
      _results.push({ status: 'FAIL', suite: name, label: 'Suite threw an uncaught error', detail: err.message });
      _failed++;
    }
  }

  const total    = _passed + _failed;
  const passRate = total > 0 ? Math.round((_passed / total) * 100) : 0;

  console.log(`\n✅ ${_passed}/${total} passed  ❌ ${_failed}/${total} failed  (${passRate}%)`);

  if (_failed > 0) {
    console.group('Failed tests:');
    console.table(_results.filter(r => r.status === 'FAIL'));
    console.groupEnd();
  }

  console.groupEnd();

  return { passed: _passed, failed: _failed, total, results: [..._results], passRate };
}

/**
 * Renders the full test report into a DOM container element.
 *
 * @param {string} containerId - id of the target DOM element
 */
export function renderTestResults(containerId) {
  const container = document.getElementById(containerId);
  if (!container) { return; }

  const report = runAllTests();

  // Group results by suite for structured display
  const suiteMap = {};
  for (const r of report.results) {
    if (!suiteMap[r.suite]) { suiteMap[r.suite] = []; }
    suiteMap[r.suite].push(r);
  }

  const suitesHtml = Object.entries(suiteMap).map(([suiteName, cases]) => {
    const suitePassed = cases.filter(c => c.status === 'PASS').length;
    const suiteTotal  = cases.length;
    const allPass     = suitePassed === suiteTotal;

    return `
      <div class="test-suite">
        <div class="test-suite__header ${allPass ? 'test-suite__header--pass' : 'test-suite__header--fail'}">
          <span>${allPass ? '✅' : '⚠️'} ${suiteName}</span>
          <span class="test-suite__count">${suitePassed}/${suiteTotal}</span>
        </div>
        <div class="test-suite__cases">
          ${cases.map(r => `
            <div class="test-row test-row--${r.status.toLowerCase()}">
              <span aria-label="${r.status}">${r.status === 'PASS' ? '✓' : '✗'}</span>
              <span>${r.label}</span>
              ${r.detail ? `<span class="test-detail">${r.detail}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="test-summary ${report.failed === 0 ? 'test-summary--pass' : 'test-summary--fail'}"
         role="status" aria-live="polite">
      <strong>${report.failed === 0 ? '✅ All tests passed!' : `⚠️ ${report.failed} test(s) failed`}</strong>
      <span>${report.passed}/${report.total} assertions passed (${report.passRate}%)</span>
    </div>
    <div class="test-suites" role="list" aria-label="Test suite results">
      ${suitesHtml}
    </div>
  `;
}
