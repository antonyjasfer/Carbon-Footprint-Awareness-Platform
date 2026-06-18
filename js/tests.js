/**
 * @module tests
 * @description Unit test suite for the Carbon Footprint Platform.
 *  Runs in the browser console; no external test runner required.
 *  Tests cover: emission calculation, storage validation, tracker aggregation,
 *  nudge generation, world health scoring, and edge cases.
 *
 *  Usage: import and call runAllTests() or trigger via the UI debug panel.
 */

import { calculateEmission, computeWorldHealth, previewEmission } from './tracker.js';
import { getTransportNudge, getEquivalence, getEmotionalContext } from './data.js';
import { storage } from './storage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Micro test runner
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
const _results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    _passed++;
    _results.push({ status: 'PASS', label, detail });
  } else {
    _failed++;
    _results.push({ status: 'FAIL', label, detail });
    console.error(`[TEST FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function assertClose(label, actual, expected, tol = 0.001) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= tol;
  assert(label, ok, `expected ~${expected}, got ${actual}`);
}

function assertThrows(label, fn) {
  try {
    fn();
    assert(label, false, 'Expected an error to be thrown but none was');
  } catch {
    assert(label, true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

function testEmissionCalculations() {
  // ── Transport ────────────────────────────────────────────────────────────
  assertClose('Car petrol 10km → 2.1 kg',        calculateEmission('transport', 'car_petrol', 10), 2.1);
  assertClose('Metro 10km → 0.41 kg',             calculateEmission('transport', 'metro', 10),     0.41);
  assertClose('Bicycle 20km → 0 kg',              calculateEmission('transport', 'bicycle', 20),   0);
  assertClose('Walking 5km → 0 kg',               calculateEmission('transport', 'walking', 5),    0);
  assertClose('Flight domestic 1000km → 255 kg',  calculateEmission('travel', 'flight_domestic', 1000), 255);

  // ── Food ─────────────────────────────────────────────────────────────────
  assertClose('Beef 1 serving → 27 kg',           calculateEmission('food', 'beef', 1),        27);
  assertClose('Vegetables 1 serving → 2 kg',      calculateEmission('food', 'vegetables', 1),  2);
  assertClose('Legumes 1 serving → 0.9 kg',       calculateEmission('food', 'legumes', 1),     0.9);
  assertClose('Coffee 2 cups → 4.2 kg',           calculateEmission('food', 'coffee', 2),      4.2);

  // ── Energy ───────────────────────────────────────────────────────────────
  assertClose('Electricity 10kWh → 8.2 kg',       calculateEmission('energy', 'electricity', 10), 8.2);
  assertClose('AC 3 hours → 2.7 kg',              calculateEmission('energy', 'ac_hour', 3),       2.7);

  // ── Shopping ─────────────────────────────────────────────────────────────
  assertClose('Clothing item → 8 kg',             calculateEmission('shopping', 'clothing_new', 1), 8);
  assertClose('Laptop → 300 kg',                  calculateEmission('shopping', 'laptop', 1),       300);
  assertClose('Online package → 0.5 kg',          calculateEmission('shopping', 'online_delivery', 1), 0.5);

  // ── Zero amount ──────────────────────────────────────────────────────────
  assertClose('Zero amount → 0 kg',               calculateEmission('transport', 'car_petrol', 0), 0);
}

function testEdgeCases() {
  // Unknown category/type should throw
  assertThrows('Unknown category throws',    () => calculateEmission('aliens', 'ufo', 10));
  assertThrows('Unknown type throws',        () => calculateEmission('transport', 'rocket', 100));

  // Negative amount should throw
  assertThrows('Negative amount throws',     () => calculateEmission('transport', 'car_petrol', -5));

  // Storage: invalid entry should throw
  assertThrows('Invalid storage entry',      () => storage.addActivity(null));
  assertThrows('Missing kgCO2 field',        () => storage.addActivity({ category: 'food', type: 'beef', amount: 1 }));
  assertThrows('Negative kgCO2',             () => storage.addActivity({ category: 'food', type: 'beef', amount: 1, kgCO2: -1 }));

  // previewEmission never throws on bad input
  const preview = previewEmission('invalid', 'invalid', NaN);
  assert('previewEmission with bad input → kgCO2:0', preview.kgCO2 === 0);
}

function testWorldHealth() {
  assert('0 kg/day → 100% health',   computeWorldHealth(0)  === 100);
  assert('25+ kg/day → 0% health',   computeWorldHealth(25) === 0);
  assert('~6.3 kg → healthy score',  computeWorldHealth(6.3) >= 50);
  assert('Health is 0–100',          computeWorldHealth(12) >= 0 && computeWorldHealth(12) <= 100);
  assert('Higher emissions → lower health',
    computeWorldHealth(5) > computeWorldHealth(15));
}

function testNudges() {
  const nudge = getTransportNudge('car_petrol', 10);
  assert('Car nudge exists',             nudge !== null);
  assert('Car nudge has savings',        nudge?.savings > 0);
  assert('Car nudge suggests alternative', typeof nudge?.altLabel === 'string');
  assert('Car nudge ratio > 1',          nudge?.ratio > 1);

  // No nudge for already-green transport
  assert('Metro nudge is null',  getTransportNudge('metro', 10)    === null);
  assert('Bike nudge is null',   getTransportNudge('bicycle', 10)  === null);
  assert('Zero distance → null', getTransportNudge('car_petrol', 0) === null);
}

function testEquivalences() {
  const eq0 = getEquivalence(0);
  assert('Zero kg → special message', eq0.includes('zero') || eq0.includes('perfect'));

  const eq10 = getEquivalence(10);
  assert('Non-zero → non-empty string', typeof eq10 === 'string' && eq10.length > 0);
}

function testEmotionalContext() {
  const c0   = getEmotionalContext(0);
  const c5   = getEmotionalContext(5);
  const c20  = getEmotionalContext(20);

  assert('0 kg → hero tier',       c0.tier === 'hero');
  assert('5 kg → good tier',       c5.tier === 'good');
  assert('20 kg → critical tier',  c20.tier === 'critical');
  assert('Context has color',       typeof c5.color === 'string' && c5.color.startsWith('#'));
  assert('Context has emoji',       typeof c5.emoji === 'string'  && c5.emoji.length > 0);
}

function testStorageSanitization() {
  // XSS attempt in name field should be sanitized
  const maliciousName = '<script>alert("xss")</script>';
  storage.saveUser({ name: maliciousName });
  const saved = storage.getUser();
  assert('XSS in name is sanitized',
    !saved.name.includes('<script>') && saved.name.includes('&lt;script&gt;'));

  // Reset to clean value
  storage.saveUser({ name: 'You' });
}

function testStoragePersistence() {
  const before = storage.getActivities().length;
  storage.addActivity({ category: 'food', type: 'beef', amount: 1, kgCO2: 27, note: '' });
  const after  = storage.getActivities().length;
  assert('Activity count increases after add', after === before + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all test suites and returns a summary report.
 * @returns {{ passed: number, failed: number, total: number, results: object[] }}
 */
export function runAllTests() {
  _passed = 0;
  _failed = 0;
  _results.length = 0;

  console.group('🧪 Carbon Footprint Platform — Test Suite');

  try { testEmissionCalculations(); } catch (e) { console.error('Suite error:', e); }
  try { testEdgeCases();            } catch (e) { console.error('Suite error:', e); }
  try { testWorldHealth();          } catch (e) { console.error('Suite error:', e); }
  try { testNudges();               } catch (e) { console.error('Suite error:', e); }
  try { testEquivalences();         } catch (e) { console.error('Suite error:', e); }
  try { testEmotionalContext();     } catch (e) { console.error('Suite error:', e); }
  try { testStorageSanitization();  } catch (e) { console.error('Suite error:', e); }
  try { testStoragePersistence();   } catch (e) { console.error('Suite error:', e); }

  const total = _passed + _failed;
  console.log(`\n✅ ${_passed}/${total} passed  ❌ ${_failed}/${total} failed`);
  if (_failed > 0) {
    console.table(_results.filter(r => r.status === 'FAIL'));
  }
  console.groupEnd();

  return { passed: _passed, failed: _failed, total, results: [..._results] };
}

/**
 * Renders test results into a DOM container (debug panel).
 * @param {string} containerId
 */
export function renderTestResults(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const report = runAllTests();
  const passRate = report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;

  container.innerHTML = `
    <div class="test-summary ${report.failed === 0 ? 'test-summary--pass' : 'test-summary--fail'}">
      <strong>${report.failed === 0 ? '✅ All tests passed!' : `⚠️ ${report.failed} test(s) failed`}</strong>
      <span>${report.passed}/${report.total} passed (${passRate}%)</span>
    </div>
    <div class="test-results">
      ${report.results.map(r => `
        <div class="test-row test-row--${r.status.toLowerCase()}">
          <span>${r.status === 'PASS' ? '✅' : '❌'}</span>
          <span>${r.label}</span>
          ${r.detail ? `<span class="test-detail">${r.detail}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
