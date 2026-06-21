/**
 * @module charts
 * @description Chart.js visualisation wrappers for the dashboard.
 *  All charts use the global Chart object (loaded from CDN).
 *  Handles create / update / destroy lifecycle correctly.
 */

import { getWeeklyChartData, getCategoryChartData } from './tracker.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared defaults
// ─────────────────────────────────────────────────────────────────────────────

const FONT_FAMILY = "'Inter', 'Segoe UI', sans-serif";

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeInOutQuart' },
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { family: FONT_FAMILY, size: 12 },
        boxWidth: 14,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 12,
      cornerRadius: 8,
      titleFont: { family: FONT_FAMILY, weight: '600' },
      bodyFont:  { family: FONT_FAMILY },
    },
  },
};

// Registry of active chart instances keyed by canvas id
const _charts = new Map();

/**
 * Creates or updates a Chart.js instance on a canvas.
 * @param {string} canvasId
 * @param {object} config - full Chart.js config
 * @returns {Chart|null}
 */
function upsertChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {return null;}

  // Destroy existing instance to prevent "Canvas is already in use" error
  if (_charts.has(canvasId)) {
    _charts.get(canvasId).destroy();
  }

  const chart = new Chart(canvas, config); // eslint-disable-line no-undef
  _charts.set(canvasId, chart);
  return chart;
}

/**
 * Destroys all registered charts (call on teardown).
 */
export function destroyAll() {
  for (const chart of _charts.values()) {chart.destroy();}
  _charts.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Bar / Line Chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders (or refreshes) the 7-day trend chart.
 * @param {string} [canvasId='chart-weekly']
 */
export function renderWeeklyChart(canvasId = 'chart-weekly') {
  const { labels, data } = getWeeklyChartData();
  const PARIS_TARGET = 6.3;

  upsertChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily CO₂ (kg)',
          data,
          backgroundColor: data.map(v =>
            v === 0     ? 'rgba(16,185,129,0.3)' :
              v <= 3      ? 'rgba(34,197,94,0.6)'  :
                v <= 6.3    ? 'rgba(132,204,22,0.6)' :
                  v <= 12     ? 'rgba(245,158,11,0.6)' :
                    'rgba(239,68,68,0.6)'
          ),
          borderColor: data.map(v =>
            v === 0     ? '#10b981' :
              v <= 3      ? '#22c55e' :
                v <= 6.3    ? '#84cc16' :
                  v <= 12     ? '#f59e0b' :
                    '#ef4444'
          ),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Paris Target (6.3 kg)',
          data:  Array(7).fill(PARIS_TARGET),
          type:  'line',
          borderColor: 'rgba(99,102,241,0.8)',
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { family: FONT_FAMILY, size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid:  { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            color: '#64748b',
            font:  { family: FONT_FAMILY, size: 11 },
            callback: (v) => `${v} kg`,
          },
        },
      },
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (ctx.datasetIndex === 1) {return `Paris Target: ${v} kg CO₂`;}
              return `${v.toFixed(2)} kg CO₂`;
            },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Doughnut Chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders (or refreshes) the category breakdown doughnut.
 * @param {string} [canvasId='chart-category']
 */
export function renderCategoryChart(canvasId = 'chart-category') {
  const { labels, data, colors } = getCategoryChartData();

  if (data.length === 0) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#64748b';
      ctx.font      = `14px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('No data yet — log some activities!', canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  upsertChart(canvasId, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      ...BASE_OPTIONS,
      cutout: '68%',
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed.toFixed(2)} kg (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 30-day trend line chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the 30-day trend line chart.
 * @param {string} [canvasId='chart-trend']
 * @param {{ date: string, kg: number }[]} days30
 */
export function renderTrendChart(canvasId = 'chart-trend', days30 = []) {
  const labels = days30.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });
  const data = days30.map(d => d.kg);

  const PARIS_TARGET = 6.3;

  upsertChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily CO₂ (kg)',
          data,
          borderColor: '#10b981',
          backgroundColor: (ctx) => {
            const chart  = ctx.chart;
            const { chartArea } = chart;
            if (!chartArea) {return 'rgba(16,185,129,0.1)';}
            const grad = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, 'rgba(16,185,129,0.25)');
            grad.addColorStop(1, 'rgba(16,185,129,0.02)');
            return grad;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: (ctx) => ctx.parsed?.y > 0 ? 3 : 0,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
        },
        {
          label: 'Paris Target',
          data:  Array(30).fill(PARIS_TARGET),
          borderColor: 'rgba(99,102,241,0.6)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font:  { family: FONT_FAMILY, size: 10 },
            maxTicksLimit: 10,
          },
        },
        y: {
          beginAtZero: true,
          grid:  { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            color: '#64748b',
            font:  { family: FONT_FAMILY, size: 11 },
            callback: (v) => `${v} kg`,
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini sparkline (no axes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a minimal sparkline for quick stat cards.
 *
 * @param {string}   canvasId - target canvas element id
 * @param {number[]} data     - array of values to plot
 * @param {string}   [color]  - hex/rgba line colour (default emerald green)
 */
export function renderSparkline(canvasId, data, color = '#10b981') {
  upsertChart(canvasId, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon Heatmap (GitHub-style contribution graph)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emission level thresholds (kg CO₂ per day) mapped to heatmap colours.
 * Uses a traffic-light palette anchored to the Paris Agreement target (6.3 kg).
 *
 * @type {Array<{max: number, bg: string, border: string, label: string}>}
 */
const HEATMAP_LEVELS = [
  { max: 0,    bg: '#1e293b',        border: '#334155',        label: 'No data'   },
  { max: 2,    bg: 'rgba(16,185,129,0.85)',  border: '#10b981', label: '0–2 kg'   },
  { max: 5,    bg: 'rgba(34,197,94,0.7)',    border: '#22c55e', label: '2–5 kg'   },
  { max: 8,    bg: 'rgba(132,204,22,0.7)',   border: '#84cc16', label: '5–8 kg'   },
  { max: 12,   bg: 'rgba(245,158,11,0.75)',  border: '#f59e0b', label: '8–12 kg'  },
  { max: 20,   bg: 'rgba(249,115,22,0.8)',   border: '#f97316', label: '12–20 kg' },
  { max: Infinity, bg: 'rgba(239,68,68,0.85)', border: '#ef4444', label: '20+ kg' },
];

/**
 * Returns the heatmap colour level for a given daily kg value.
 *
 * @param {number} kg - daily CO₂ in kg
 * @returns {{ bg: string, border: string, label: string }}
 */
function heatmapLevel(kg) {
  if (kg === 0) { return HEATMAP_LEVELS[0]; }
  return HEATMAP_LEVELS.find(l => kg < l.max) ?? HEATMAP_LEVELS[HEATMAP_LEVELS.length - 1];
}

/**
 * Renders a GitHub-style 30-day carbon activity heatmap into a DOM container.
 *
 * Each cell represents one day. Colour intensity reflects that day's total
 * CO₂ output relative to the Paris Agreement target. Cells are fully
 * keyboard-accessible with title attributes and ARIA labels.
 *
 * @param {string}   containerId - id of the target div element
 * @param {Array<{date: string, kg: number}>} days30 - 30-day daily entries
 */
export function renderCarbonHeatmap(containerId, days30 = []) {
  const container = document.getElementById(containerId);
  if (!container || days30.length === 0) { return; }

  const cells = days30.map(({ date, kg }) => {
    const level = heatmapLevel(kg);
    const dateObj = new Date(date + 'T00:00:00');
    const label   = dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const kgStr   = kg > 0 ? `${kg.toFixed(2)} kg CO₂` : 'No data';

    return `<div
      class="heatmap-cell"
      style="background:${level.bg};border-color:${level.border};"
      title="${label}: ${kgStr}"
      role="gridcell"
      aria-label="${label}: ${kgStr} — ${level.label}"
      tabindex="0"
    ></div>`;
  }).join('');

  // Legend items (only once, skip level 0 = no data)
  const legend = HEATMAP_LEVELS.slice(1).map(l =>
    `<span class="heatmap-legend-cell" style="background:${l.bg};border-color:${l.border};"></span>
     <span class="heatmap-legend-label">${l.label}</span>`
  ).join('');

  container.innerHTML = `
    <div class="heatmap-wrapper" role="grid" aria-label="30-day carbon emissions heatmap">
      <div class="heatmap-grid">${cells}</div>
    </div>
    <div class="heatmap-legend" aria-label="Colour legend for emissions levels">
      <span class="heatmap-legend-label">Low</span>
      ${legend}
      <span class="heatmap-legend-label">High</span>
    </div>`;
}
