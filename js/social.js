/**
 * @module social
 * @description Social features: team creation/join, individual & team
 *  leaderboards, friendly rivalries, and streak tracking display.
 *  Data is persisted locally; seed data simulates other users.
 */

import { storage } from './storage.js';
import { SAMPLE_TEAMS, SAMPLE_INDIVIDUALS } from './data.js';
import { computeStats } from './tracker.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EMISSION_BENCHMARK = 20;
const STREAK_BONUS_MULTIPLIER = 0.5;
const MAX_STREAK_BONUS = 10;
const TEAM_IMPROVEMENT_FACTOR = 0.3;
const MAX_TEAM_NAME_LENGTH = 40;

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Score computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a leaderboard "Green Score" (higher = better).
 * Formula: 100 - (avgDailyKg / 20 * 100) clamped to 0–100, + streak bonus.
 * @param {number} avgDailyKg
 * @param {number} streak
 * @returns {number} 0–100
 */
function computeScore(avgDailyKg, streak) {
  const emissionScore = Math.max(0, 100 - (avgDailyKg / MAX_EMISSION_BENCHMARK) * 100);
  const streakBonus   = Math.min(streak * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS);
  return Math.min(100, parseFloat((emissionScore + streakBonus).toFixed(1)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual leaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the combined leaderboard (user + sample peers).
 * @returns {{ rank: number, name: string, avatar: string, weeklyKg: number, streak: number, score: number, isMe: boolean }[]}
 */
export function getIndividualLeaderboard() {
  try {
    const stats    = computeStats();
    const user     = storage.getUser();
    const settings = storage.getSettings();

    const meEntry = {
      id:       'me',
      name:     user.name ?? 'You',
      avatar:   user.avatar ?? '🌍',
      weeklyKg: parseFloat(stats.weekKg.toFixed(1)),
      streak:   stats.currentStreak,
      score:    computeScore(stats.avgDailyKg, stats.currentStreak),
      team:     settings.teamName ?? 'No team',
      isMe:     true,
    };

    // Merge with sample individuals (exclude same team-name collision)
    const allEntries = [meEntry, ...SAMPLE_INDIVIDUALS.map(u => ({ ...u, isMe: false }))];

    // Sort by score descending
    allEntries.sort((a, b) => b.score - a.score);

    // Assign ranks
    return allEntries.map((u, i) => ({ ...u, rank: i + 1 }));
  } catch (error) {
    console.error('Failed to compute individual leaderboard', error);
    return [];
  }
}

/**
 * Gets the user's current rank in the individual leaderboard.
 * @returns {number}
 */
export function getMyRank() {
  const board = getIndividualLeaderboard();
  return board.find(u => u.isMe)?.rank ?? -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team leaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the team leaderboard, injecting user's team if they have one.
 * @returns {{ rank: number, id: string, name: string, avatar: string, members: number, weeklyKg: number, score: number, isMyTeam: boolean }[]}
 */
export function getTeamLeaderboard() {
  try {
    const settings = storage.getSettings();
    const stats    = computeStats();

    const teams = [...SAMPLE_TEAMS.map(t => ({ ...t, isMyTeam: false }))];

    if (settings.teamId && settings.teamName) {
      // Update or inject user's team
      const existing = teams.find(t => t.id === settings.teamId);
      if (existing) {
        existing.isMyTeam = true;
        // Slightly improve team score if user is doing well
        existing.score = Math.min(100, existing.score + stats.currentStreak * TEAM_IMPROVEMENT_FACTOR);
      } else {
        teams.push({
          id:      settings.teamId,
          name:    settings.teamName,
          avatar:  '⭐',
          members: 1,
          weeklyKg: parseFloat(stats.weekKg.toFixed(1)),
          score:   computeScore(stats.avgDailyKg, stats.currentStreak),
          isMyTeam: true,
        });
      }
    }

    teams.sort((a, b) => b.score - a.score);
    return teams.map((t, i) => ({ ...t, rank: i + 1 }));
  } catch (error) {
    console.error('Failed to compute team leaderboard', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Team management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new team and joins it.
 * @param {string} teamName
 * @returns {{ success: boolean, message: string }}
 */
export function createTeam(teamName) {
  if (!teamName?.trim()) {return { success: false, message: 'Team name cannot be empty.' };}
  if (teamName.trim().length > MAX_TEAM_NAME_LENGTH) {return { success: false, message: `Team name is too long (max ${MAX_TEAM_NAME_LENGTH} chars).` };}

  const id = 'team_' + Date.now();
  storage.saveSettings({ teamId: id, teamName: teamName.trim() });
  storage.saveUser({ teamId: id });

  return { success: true, message: `Team "${teamName.trim()}" created! Invite friends to join.` };
}

/**
 * Joins an existing team (from SAMPLE_TEAMS pool or by name match).
 * @param {string} teamName
 * @returns {{ success: boolean, message: string }}
 */
export function joinTeam(teamName) {
  if (!teamName?.trim()) {return { success: false, message: 'Team name cannot be empty.' };}

  const name    = teamName.trim();
  const existing = SAMPLE_TEAMS.find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );

  const id = existing?.id ?? ('team_' + name.toLowerCase().replace(/\s+/g, '_'));
  storage.saveSettings({ teamId: id, teamName: name });
  storage.saveUser({ teamId: id });

  return { success: true, message: `Joined team "${name}"! Compete for the top spot!` };
}

/**
 * Leaves current team.
 */
export function leaveTeam() {
  storage.saveSettings({ teamId: null, teamName: null });
  storage.saveUser({ teamId: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// Render helpers (DOM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a medal emoji for top 3 ranks, or a formatted rank string.
 * @param {number} rank
 * @returns {string}
 */
function rankMedal(rank) {
  if (rank === 1) {return '🥇';}
  if (rank === 2) {return '🥈';}
  if (rank === 3) {return '🥉';}
  return `#${rank}`;
}

/**
 * Returns the CSS class for a score badge based on score thresholds.
 * @param {number} score
 * @returns {string}
 */
function scoreBadge(score) {
  if (score >= 85) {return 'badge--green';}
  if (score >= 60) {return 'badge--yellow';}
  return 'badge--red';
}

/**
 * Renders the individual leaderboard table into a container.
 * @param {string} containerId
 */
export function renderIndividualLeaderboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  const board = getIndividualLeaderboard();

  container.innerHTML = board.map(u => `
    <div class="leaderboard-row ${u.isMe ? 'leaderboard-row--me' : ''}" 
         role="row" aria-label="${escapeHTML(u.name)}, rank ${u.rank}">
      <span class="lb-rank" aria-label="Rank">${rankMedal(u.rank)}</span>
      <span class="lb-avatar" aria-hidden="true">${escapeHTML(u.avatar)}</span>
      <span class="lb-info">
        <span class="lb-name">${escapeHTML(u.name)}${u.isMe ? ' <span class="you-tag">You</span>' : ''}</span>
        <span class="lb-team">${escapeHTML(u.team ?? '')}</span>
      </span>
      <span class="lb-stats">
        <span class="lb-kg">${u.weeklyKg} kg</span>
        <span class="lb-streak">🔥 ${u.streak}d</span>
      </span>
      <span class="lb-score">
        <span class="badge ${scoreBadge(u.score)}">${u.score}</span>
      </span>
    </div>
  `).join('');
}

/**
 * Renders the team leaderboard table into a container.
 * @param {string} containerId
 */
export function renderTeamLeaderboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  const board = getTeamLeaderboard();

  container.innerHTML = board.map(t => `
    <div class="leaderboard-row ${t.isMyTeam ? 'leaderboard-row--me' : ''}"
         role="row" aria-label="${escapeHTML(t.name)}, rank ${t.rank}">
      <span class="lb-rank" aria-label="Rank">${rankMedal(t.rank)}</span>
      <span class="lb-avatar" aria-hidden="true">${escapeHTML(t.avatar)}</span>
      <span class="lb-info">
        <span class="lb-name">${escapeHTML(t.name)}${t.isMyTeam ? ' <span class="you-tag">Your Team</span>' : ''}</span>
        <span class="lb-team">${t.members} members</span>
      </span>
      <span class="lb-stats">
        <span class="lb-kg">${t.weeklyKg} kg</span>
      </span>
      <span class="lb-score">
        <span class="badge ${scoreBadge(t.score)}">${t.score}</span>
      </span>
    </div>
  `).join('');
}
