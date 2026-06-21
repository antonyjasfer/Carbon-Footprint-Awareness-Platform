/**
 * @module insights
 * @description AI-powered insights engine using the Google Gemini API.
 *  - Builds a rich context prompt from stored activity data
 *  - Calls Gemini generateContent endpoint
 *  - Parses structured JSON response into displayable insight cards
 *  - Gracefully degrades to static rule-based insights when no API key
 *
 * Security: API key is read at call-time from storage; NEVER hardcoded here.
 */

import { storage } from './storage.js';
import { computeStats } from './tracker.js';
import { GLOBAL_AVG_DAILY_KG, PARIS_TARGET_DAILY } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// Gemini API config
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the Gemini prompt from the user's stats.
 * @param {object} stats - from computeStats()
 * @param {string} userName
 * @returns {string}
 */
function buildPrompt(stats, userName) {
  const catBreakdown = Object.entries(stats.categoryBreakdown)
    .map(([cat, kg]) => `${cat}: ${kg.toFixed(2)} kg`)
    .join(', ');

  return `You are an expert sustainability coach. Analyse this user's carbon footprint data and return a JSON object with actionable insights.

User: ${userName}
Today's CO₂: ${stats.todayKg} kg (global avg is ${GLOBAL_AVG_DAILY_KG} kg/day, Paris target is ${PARIS_TARGET_DAILY} kg/day)
Weekly total: ${stats.weekKg} kg CO₂e
Average daily: ${stats.avgDailyKg} kg CO₂e
Current streak: ${stats.currentStreak} days
Category breakdown (last 7 days): ${catBreakdown || 'No data yet'}
Total activities logged: ${stats.totalLogs}

Return ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "summary": "One encouraging sentence about their progress",
  "topCategory": "The highest-emission category name",
  "topTip": "One specific, actionable tip to reduce their biggest emission source (max 2 sentences)",
  "weeklyChallenge": "A concrete weekly challenge tailored to their data (max 2 sentences)",
  "funFact": "An interesting carbon fact relevant to their top emission category",
  "score": <number 0-100 rating their week, considering avg daily vs Paris target>,
  "trend": "<improving|worsening|stable>",
  "microActions": ["action 1", "action 2", "action 3"]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini API call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the Gemini API and returns parsed insight data.
 * @param {string} apiKey
 * @returns {Promise<InsightData>}
 * @throws {Error} on network / API error
 */
async function callGemini(apiKey) {
  const stats  = computeStats();
  const user   = storage.getUser();
  const prompt = buildPrompt(stats, user.name ?? 'User');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.4,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }

  const json  = await response.json();
  const text  = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Try to parse as JSON (model should return JSON per responseMimeType)
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON block if wrapped in markdown
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {return JSON.parse(match[0]);}
    throw new Error('Could not parse Gemini response as JSON');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Static fallback insights (rule-based, no API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates rule-based insights without requiring an API key.
 * @returns {InsightData}
 */
function staticInsights() {
  const stats = computeStats();
  const breakdown = stats.categoryBreakdown;

  const topCat = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'transport';

  const tips = {
    transport: 'Try switching to metro or bus for your daily commute — it can cut transport emissions by up to 80%.',
    food:      'Reducing beef consumption by one serving per week saves ~25 kg CO₂ per month.',
    energy:    'Setting your AC 2°C warmer can reduce its energy consumption by ~10%.',
    shopping:  'Choosing second-hand clothing for one purchase avoids ~8 kg CO₂ per item.',
    travel:    'Choosing train over short-haul flights cuts emissions by up to 6× per journey.',
  };

  const challenges = {
    transport: 'Use only public transport or cycle for the next 5 days.',
    food:      'Try eating plant-based meals for the next 7 days.',
    energy:    'Turn off all standby electronics for 5 days.',
    shopping:  'Avoid any non-essential purchases for 7 days.',
    travel:    'Plan your next trip by train instead of flying.',
  };

  const trend = stats.avgDailyKg <= PARIS_TARGET_DAILY ? 'improving' : 'worsening';
  const score = Math.max(0, Math.min(100, Math.round(100 - (stats.avgDailyKg / 20) * 100)));

  return {
    summary: stats.totalLogs === 0
      ? "Great that you're here! Log your first activity to start tracking your footprint."
      : `You're averaging ${stats.avgDailyKg.toFixed(1)} kg CO₂ per day — keep pushing towards the Paris target of ${PARIS_TARGET_DAILY} kg!`,
    topCategory:     topCat,
    topTip:          tips[topCat] ?? tips.transport,
    weeklyChallenge: challenges[topCat] ?? challenges.transport,
    funFact: 'The average person in a high-income country emits ~13 kg of CO₂ per day — mostly from transport and diet.',
    score,
    trend,
    microActions: [
      'Carry a reusable bottle & bag today',
      'Walk or cycle for trips under 2 km',
      'Choose the vegetarian option at your next meal',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches AI insights. Uses Gemini if API key provided, otherwise falls back
 * to static rule-based insights.
 * @param {string} [apiKeyOverride] - optional key (overrides stored setting)
 * @returns {Promise<{ data: InsightData, source: 'gemini'|'static' }>}
 */
export async function fetchInsights(apiKeyOverride) {
  const settings = storage.getSettings();
  const key = (apiKeyOverride ?? settings.geminiApiKey ?? '').trim();

  if (key) {
    try {
      const data = await callGemini(key);
      return { data, source: 'gemini' };
    } catch (err) {
      console.warn('[Insights] Gemini API call failed:', err.message);
      return { data: staticInsights(), source: 'static', error: err.message };
    }
  }

  return { data: staticInsights(), source: 'static' };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Renderer
// ─────────────────────────────────────────────────────────────────────────────

const TREND_ICONS = { improving: '📈', worsening: '📉', stable: '➡️' };
const TREND_COLORS = { improving: '#22c55e', worsening: '#ef4444', stable: '#f59e0b' };

/**
 * Renders insight cards into the #insights-output container.
 * @param {{ data: InsightData, source: string, error?: string }} result
 */
export function renderInsights(result) {
  const container = document.getElementById('insights-output');
  if (!container) {return;}

  const { data, source, error } = result;
  if (!data) {
    container.innerHTML = `<p class="insights-error">Could not load insights. ${error ?? ''}</p>`;
    return;
  }

  const trendIcon  = TREND_ICONS[data.trend]  ?? '➡️';
  const trendColor = TREND_COLORS[data.trend] ?? '#f59e0b';
  const sourceBadge = source === 'gemini'
    ? '<span class="badge badge--blue">✨ Gemini AI</span>'
    : '<span class="badge badge--yellow">📊 Rule-based</span>';

  container.innerHTML = `
    <div class="insights-header">
      <p class="insights-summary">${data.summary ?? ''}</p>
      <div class="insights-meta">
        ${sourceBadge}
        ${error ? '<span class="badge badge--red">⚠️ API unavailable — showing static insights</span>' : ''}
      </div>
    </div>

    <div class="insights-grid">

      <div class="insight-card insight-card--score" role="region" aria-label="Weekly score">
        <div class="insight-card__icon">🌍</div>
        <div class="insight-card__score" aria-label="Score ${data.score} out of 100">${data.score ?? '—'}</div>
        <div class="insight-card__label">Weekly Green Score</div>
        <div class="insight-card__trend" style="color:${trendColor}">${trendIcon} ${data.trend ?? ''}</div>
      </div>

      <div class="insight-card" role="region" aria-label="Top emission tip">
        <div class="insight-card__icon">💡</div>
        <h3 class="insight-card__title">Top Tip</h3>
        <p class="insight-card__body">${data.topTip ?? ''}</p>
        ${data.topCategory ? `<span class="badge badge--red">#1 Source: ${data.topCategory}</span>` : ''}
      </div>

      <div class="insight-card" role="region" aria-label="Weekly challenge">
        <div class="insight-card__icon">🏆</div>
        <h3 class="insight-card__title">This Week's Challenge</h3>
        <p class="insight-card__body">${data.weeklyChallenge ?? ''}</p>
      </div>

      <div class="insight-card" role="region" aria-label="Fun fact">
        <div class="insight-card__icon">🔬</div>
        <h3 class="insight-card__title">Did You Know?</h3>
        <p class="insight-card__body">${data.funFact ?? ''}</p>
      </div>

    </div>

    ${data.microActions?.length ? `
    <div class="micro-actions" role="region" aria-label="Quick wins for today">
      <h3 class="micro-actions__title">⚡ Quick Wins for Today</h3>
      <ul class="micro-actions__list">
        ${data.microActions.map(a => `<li class="micro-action-item">
          <span class="micro-action-check" aria-hidden="true">✓</span> ${a}
        </li>`).join('')}
      </ul>
    </div>` : ''}
  `;
}
