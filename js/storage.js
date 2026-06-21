/**
 * @module storage
 * @description Secure LocalStorage manager with:
 *  - JSON schema validation
 *  - Input sanitization to prevent XSS stored in localStorage
 *  - Versioned schema (auto-migration on upgrade)
 *  - Graceful fallback if storage is unavailable (private browsing)
 */

import { PARIS_TARGET_DAILY } from './data.js';

const STORAGE_VERSION = 1;
const KEYS = {
  VERSION:    'cfp_version',
  USER:       'cfp_user',
  ACTIVITIES: 'cfp_activities',
  TEAM:       'cfp_team',
  CHALLENGES: 'cfp_challenges',
  SETTINGS:   'cfp_settings',
  ACHIEVEMENTS:'cfp_achievements',
};

/** @type {number} Maximum number of activity entries stored to avoid localStorage bloat. */
const MAX_ACTIVITIES = 1000;

/** @type {number} Green points awarded for each daily log. */
const GREEN_POINTS_PER_LOG = 10;

/** @type {number} Green points awarded for completing a challenge. */
const GREEN_POINTS_PER_CHALLENGE = 100;

/** @type {number} Days per week — used to derive weeklyTarget from dailyTarget. */
const DAYS_PER_WEEK = 7;

// ─────────────────────────────────────────────────────────────────────────────
// Utility: safe sanitize to strip potential XSS from string values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips HTML tags from a string to prevent XSS when rendered.
 * @param {string} str
 * @returns {string}
 */
function sanitize(str) {
  if (typeof str !== 'string') {return String(str ?? '');}
  return str
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Recursively sanitizes all string values in an object/array.
 * @param {*} value
 * @returns {*}
 */
function deepSanitize(value) {
  if (typeof value === 'string')  {return sanitize(value);}
  if (Array.isArray(value))       {return value.map(deepSanitize);}
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [sanitize(k), deepSanitize(v)])
    );
  }
  return value; // numbers, booleans, null — untouched
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: safe localStorage access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads and parses a JSON value from localStorage.
 * @param {string} key - localStorage key
 * @returns {*} parsed value, or null if absent or unparseable
 */
function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Serialises a value and writes it to localStorage.
 * @param {string} key   - localStorage key
 * @param {*}      value - value to serialise as JSON
 * @returns {boolean} true if the write succeeded
 */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn('[StorageManager] LocalStorage write failed — storage may be full or disabled.');
    return false;
  }
}

/**
 * Removes a key from localStorage, ignoring errors.
 * @param {string} key - localStorage key to remove
 * @returns {void}
 */
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default schemas
// ─────────────────────────────────────────────────────────────────────────────

/** @type {{name: string, avatar: string, joinedAt: string, greenPoints: number, streak: number, lastLogDate: string|null}} */
const DEFAULT_USER = {
  name: 'You',
  avatar: '🌍',
  joinedAt: new Date().toISOString(),
  greenPoints: 0,
  streak: 0,
  lastLogDate: null,
};

/** @type {{geminiApiKey: string, dailyTarget: number, weeklyTarget: number, theme: string, notifications: boolean, units: string, teamId: string|null, teamName: string|null}} */
const DEFAULT_SETTINGS = {
  geminiApiKey: '',
  dailyTarget: PARIS_TARGET_DAILY,
  weeklyTarget: PARIS_TARGET_DAILY * DAYS_PER_WEEK,
  theme: 'dark',
  notifications: true,
  units: 'metric',
  teamId: null,
  teamName: null,
};

/** @type {Object.<string, {startDate: string, progress: number, completed: boolean}>} */
const DEFAULT_CHALLENGES_STATE = {};

// ─────────────────────────────────────────────────────────────────────────────
// StorageManager class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages persistent application state in localStorage.
 *
 * Provides CRUD operations for user profile, activity log, settings,
 * achievements, challenges, and team data, with built-in XSS sanitisation
 * and versioned schema migration.
 *
 * @class
 */
class StorageManager {
  constructor() {
    this._init();
  }

  /** Initialise storage, run migrations if needed. */
  _init() {
    const storedVersion = safeGet(KEYS.VERSION);
    if (!storedVersion) {
      // Fresh install — write defaults
      safeSet(KEYS.VERSION, STORAGE_VERSION);
      safeSet(KEYS.USER, DEFAULT_USER);
      safeSet(KEYS.ACTIVITIES, []);
      safeSet(KEYS.CHALLENGES, DEFAULT_CHALLENGES_STATE);
      safeSet(KEYS.SETTINGS, DEFAULT_SETTINGS);
      safeSet(KEYS.ACHIEVEMENTS, []);
    } else if (storedVersion < STORAGE_VERSION) {
      this._migrate(storedVersion);
    }
  }

  /** Schema migration handler — extend as versions increase. */
  _migrate(fromVersion) {
    console.info(`[StorageManager] Migrating from v${fromVersion} to v${STORAGE_VERSION}`);
    // v1 → future: add migrations here
    safeSet(KEYS.VERSION, STORAGE_VERSION);
  }

  // ── User Profile ─────────────────────────────────────────────────────────

  /**
   * Returns the current user profile, merged with defaults.
   * @returns {{name: string, avatar: string, joinedAt: string, greenPoints: number, streak: number, lastLogDate: string|null}}
   */
  getUser() {
    return { ...DEFAULT_USER, ...(safeGet(KEYS.USER) ?? {}) };
  }

  /**
   * Merges whitelisted fields into the stored user profile.
   * @param {Object} updates - partial user fields to update
   * @returns {void}
   */
  saveUser(updates) {
    const current = this.getUser();
    const sanitized = deepSanitize(updates);
    // Whitelist allowed fields
    const allowed = ['name', 'avatar', 'greenPoints', 'streak', 'lastLogDate', 'teamId'];
    const filtered = Object.fromEntries(
      Object.entries(sanitized).filter(([k]) => allowed.includes(k))
    );
    safeSet(KEYS.USER, { ...current, ...filtered });
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  /**
   * Returns the current settings, merged with defaults.
   * @returns {{geminiApiKey: string, dailyTarget: number, weeklyTarget: number, theme: string, notifications: boolean, units: string, teamId: string|null, teamName: string|null}}
   */
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...(safeGet(KEYS.SETTINGS) ?? {}) };
  }

  /**
   * Merges whitelisted fields into the stored settings.
   * @param {Object} updates - partial settings fields to update
   * @returns {void}
   */
  saveSettings(updates) {
    const current = this.getSettings();
    const sanitized = deepSanitize(updates);
    const allowed = ['geminiApiKey', 'dailyTarget', 'weeklyTarget', 'theme',
      'notifications', 'units', 'teamId', 'teamName'];
    const filtered = Object.fromEntries(
      Object.entries(sanitized).filter(([k]) => allowed.includes(k))
    );
    safeSet(KEYS.SETTINGS, { ...current, ...filtered });
  }

  // ── Activity Log ──────────────────────────────────────────────────────────

  /**
   * Returns all stored activities (newest first).
   * @returns {Object[]} array of activity records
   */
  getActivities() {
    const raw = safeGet(KEYS.ACTIVITIES);
    return Array.isArray(raw) ? raw : [];
  }

  /**
   * Adds an activity entry. Validates shape before saving.
   * @param {{ category: string, type: string, amount: number, kgCO2: number, note: string }} entry
   * @returns {object} saved entry with generated id and timestamp
   */
  addActivity(entry) {
    if (!entry || typeof entry !== 'object') {throw new Error('Invalid activity entry');}

    // Validate required fields
    const required = ['category', 'type', 'amount', 'kgCO2'];
    for (const field of required) {
      if (entry[field] === undefined || entry[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    if (typeof entry.kgCO2 !== 'number' || isNaN(entry.kgCO2) || entry.kgCO2 < 0) {
      throw new Error('kgCO2 must be a non-negative number');
    }

    const activities = this.getActivities();
    const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const saved = {
      id,
      timestamp: new Date().toISOString(),
      category:  sanitize(String(entry.category)),
      type:      sanitize(String(entry.type)),
      amount:    Number(entry.amount),
      kgCO2:     Number(entry.kgCO2.toFixed(4)),
      note:      sanitize(String(entry.note ?? '')),
      label:     sanitize(String(entry.label ?? entry.type)),
    };

    activities.unshift(saved); // newest first
    if (activities.length > MAX_ACTIVITIES) {activities.splice(MAX_ACTIVITIES);}
    safeSet(KEYS.ACTIVITIES, activities);

    this._updateStreak();
    return saved;
  }

  /**
   * Removes an activity by its unique ID.
   * @param {string} id - activity record ID
   * @returns {void}
   * @throws {Error} if id is not a string
   */
  deleteActivity(id) {
    if (typeof id !== 'string') {
      throw new Error(`deleteActivity: id must be a string, got ${typeof id}`);
    }
    const activities = this.getActivities();
    const filtered = activities.filter(a => a.id !== id);
    safeSet(KEYS.ACTIVITIES, filtered);
  }

  /**
   * Returns activities within [startDate, endDate] ISO strings.
   * @param {string} startDate - ISO date string (inclusive lower bound)
   * @param {string} endDate   - ISO date string (inclusive upper bound)
   * @returns {Object[]} matching activity records
   */
  getActivitiesInRange(startDate, endDate) {
    return this.getActivities().filter(a => {
      const t = a.timestamp;
      return t >= startDate && t <= endDate;
    });
  }

  /**
   * Returns all activities logged today (since midnight local time).
   * @returns {Object[]} today's activity records
   */
  getTodayActivities() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getActivities().filter(a => new Date(a.timestamp) >= today);
  }

  /**
   * Returns activities for the last N days.
   * @param {number} [days=7] - number of past days to include
   * @returns {Object[]} activity records within the window
   */
  getRecentActivities(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    return this.getActivities().filter(a => new Date(a.timestamp) >= since);
  }

  // ── Streak tracking ───────────────────────────────────────────────────────

  /**
   * Updates the user's consecutive logging streak and awards daily green points.
   * @returns {void}
   * @private
   */
  _updateStreak() {
    const user = this.getUser();
    const todayStr = new Date().toDateString();

    if (user.lastLogDate === todayStr) {return;} // Already logged today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const newStreak = user.lastLogDate === yesterdayStr ? (user.streak ?? 0) + 1 : 1;

    this.saveUser({
      streak: newStreak,
      lastLogDate: todayStr,
      greenPoints: (user.greenPoints ?? 0) + GREEN_POINTS_PER_LOG,
    });
  }

  // ── Achievements ──────────────────────────────────────────────────────────

  /**
   * Returns the list of unlocked achievement IDs.
   * @returns {string[]} unlocked achievement IDs
   */
  getUnlockedAchievements() {
    const raw = safeGet(KEYS.ACHIEVEMENTS);
    return Array.isArray(raw) ? raw : [];
  }

  /**
   * Marks an achievement as unlocked if it hasn't been already.
   * @param {string} id - achievement ID
   * @returns {boolean} true if newly unlocked, false if already had it
   */
  unlockAchievement(id) {
    const unlocked = this.getUnlockedAchievements();
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      safeSet(KEYS.ACHIEVEMENTS, unlocked);
      return true; // newly unlocked
    }
    return false; // already had it
  }

  // ── Challenges ────────────────────────────────────────────────────────────

  /**
   * Returns the state map of all challenges.
   * @returns {Object.<string, {startDate: string, progress: number, completed: boolean}>}
   */
  getChallengesState() {
    const raw = safeGet(KEYS.CHALLENGES);
    return (raw && typeof raw === 'object') ? raw : {};
  }

  /**
   * Starts tracking a challenge (no-op if already completed).
   * @param {string} challengeId - challenge ID to start
   * @returns {void}
   */
  startChallenge(challengeId) {
    const state = this.getChallengesState();
    if (state[challengeId]?.completed) {return;} // already done
    state[challengeId] = {
      startDate: new Date().toISOString(),
      progress:  0,
      completed: false,
    };
    safeSet(KEYS.CHALLENGES, state);
  }

  /**
   * Updates the progress value for an active challenge.
   * @param {string} challengeId - challenge ID
   * @param {number} progress    - new progress value (must be a finite number)
   * @returns {void}
   * @throws {Error} if progress is not a finite number
   */
  updateChallengeProgress(challengeId, progress) {
    if (!Number.isFinite(progress)) {
      throw new Error(`updateChallengeProgress: progress must be a finite number, got ${progress}`);
    }
    const state = this.getChallengesState();
    if (!state[challengeId]) {return;}
    state[challengeId].progress = progress;
    safeSet(KEYS.CHALLENGES, state);
  }

  /**
   * Marks a challenge as completed and awards green points.
   * @param {string} challengeId - challenge ID to complete
   * @returns {void}
   */
  completeChallenge(challengeId) {
    const state = this.getChallengesState();
    if (!state[challengeId]) {return;}
    state[challengeId].completed  = true;
    state[challengeId].completedAt = new Date().toISOString();
    safeSet(KEYS.CHALLENGES, state);

    const user = this.getUser();
    this.saveUser({ greenPoints: (user.greenPoints ?? 0) + GREEN_POINTS_PER_CHALLENGE });
  }

  // ── Team ─────────────────────────────────────────────────────────────────

  /**
   * Returns the stored team data, or null if none.
   * @returns {Object|null}
   */
  getTeamData() {
    return safeGet(KEYS.TEAM);
  }

  /**
   * Persists team data after sanitisation.
   * @param {Object} team - team data to store
   * @returns {void}
   */
  saveTeamData(team) {
    safeSet(KEYS.TEAM, deepSanitize(team));
  }

  // ── Export / Import ───────────────────────────────────────────────────────

  /**
   * Exports all user data as a JSON string (API key is redacted).
   * @returns {string} pretty-printed JSON export
   */
  exportData() {
    return JSON.stringify({
      version:     STORAGE_VERSION,
      exportedAt:  new Date().toISOString(),
      user:        this.getUser(),
      activities:  this.getActivities(),
      settings:    { ...this.getSettings(), geminiApiKey: '[REDACTED]' },
      achievements: this.getUnlockedAchievements(),
    }, null, 2);
  }

  /**
   * Erases all stored data and re-initialises with defaults.
   * @returns {void}
   */
  clearAll() {
    Object.values(KEYS).forEach(safeRemove);
    this._init();
  }
}

// Singleton export
export const storage = new StorageManager();
