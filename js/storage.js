/**
 * @module storage
 * @description Secure LocalStorage manager with:
 *  - JSON schema validation
 *  - Input sanitization to prevent XSS stored in localStorage
 *  - Versioned schema (auto-migration on upgrade)
 *  - Graceful fallback if storage is unavailable (private browsing)
 */

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

// ─────────────────────────────────────────────────────────────────────────────
// Utility: safe sanitize to strip potential XSS from string values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips HTML tags from a string to prevent XSS when rendered.
 * @param {string} str
 * @returns {string}
 */
function sanitize(str) {
  if (typeof str !== 'string') return String(str ?? '');
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
  if (typeof value === 'string')  return sanitize(value);
  if (Array.isArray(value))       return value.map(deepSanitize);
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

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn('[StorageManager] LocalStorage write failed — storage may be full or disabled.');
    return false;
  }
}

function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default schemas
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_USER = {
  name: 'You',
  avatar: '🌍',
  joinedAt: new Date().toISOString(),
  greenPoints: 0,
  streak: 0,
  lastLogDate: null,
};

const DEFAULT_SETTINGS = {
  geminiApiKey: '',
  dailyTarget: 6.3,          // kg CO₂e (Paris Agreement daily target)
  weeklyTarget: 44.1,
  theme: 'dark',
  notifications: true,
  units: 'metric',
  teamId: null,
  teamName: null,
};

const DEFAULT_CHALLENGES_STATE = {}; // { [challengeId]: { startDate, progress, completed } }

// ─────────────────────────────────────────────────────────────────────────────
// StorageManager class
// ─────────────────────────────────────────────────────────────────────────────

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

  getUser() {
    return { ...DEFAULT_USER, ...(safeGet(KEYS.USER) ?? {}) };
  }

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

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...(safeGet(KEYS.SETTINGS) ?? {}) };
  }

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
    if (!entry || typeof entry !== 'object') throw new Error('Invalid activity entry');

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
    const saved = {
      id:        crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category:  sanitize(String(entry.category)),
      type:      sanitize(String(entry.type)),
      amount:    Number(entry.amount),
      kgCO2:     Number(entry.kgCO2.toFixed(4)),
      note:      sanitize(String(entry.note ?? '')),
      label:     sanitize(String(entry.label ?? entry.type)),
    };

    activities.unshift(saved); // newest first
    // Keep max 1000 entries to avoid bloating storage
    if (activities.length > 1000) activities.splice(1000);
    safeSet(KEYS.ACTIVITIES, activities);

    this._updateStreak();
    return saved;
  }

  deleteActivity(id) {
    const activities = this.getActivities();
    const filtered = activities.filter(a => a.id !== id);
    safeSet(KEYS.ACTIVITIES, filtered);
  }

  /** Returns activities within [startDate, endDate] ISO strings. */
  getActivitiesInRange(startDate, endDate) {
    return this.getActivities().filter(a => {
      const t = a.timestamp;
      return t >= startDate && t <= endDate;
    });
  }

  /** Returns activities for today. */
  getTodayActivities() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getActivities().filter(a => new Date(a.timestamp) >= today);
  }

  /** Returns activities for the last N days. */
  getRecentActivities(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    return this.getActivities().filter(a => new Date(a.timestamp) >= since);
  }

  // ── Streak tracking ───────────────────────────────────────────────────────

  _updateStreak() {
    const user = this.getUser();
    const todayStr = new Date().toDateString();

    if (user.lastLogDate === todayStr) return; // Already logged today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const newStreak = user.lastLogDate === yesterdayStr ? (user.streak ?? 0) + 1 : 1;

    this.saveUser({
      streak: newStreak,
      lastLogDate: todayStr,
      greenPoints: (user.greenPoints ?? 0) + 10, // +10 pts for logging
    });
  }

  // ── Achievements ──────────────────────────────────────────────────────────

  getUnlockedAchievements() {
    const raw = safeGet(KEYS.ACHIEVEMENTS);
    return Array.isArray(raw) ? raw : [];
  }

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

  getChallengesState() {
    const raw = safeGet(KEYS.CHALLENGES);
    return (raw && typeof raw === 'object') ? raw : {};
  }

  startChallenge(challengeId) {
    const state = this.getChallengesState();
    if (state[challengeId]?.completed) return; // already done
    state[challengeId] = {
      startDate: new Date().toISOString(),
      progress:  0,
      completed: false,
    };
    safeSet(KEYS.CHALLENGES, state);
  }

  updateChallengeProgress(challengeId, progress) {
    const state = this.getChallengesState();
    if (!state[challengeId]) return;
    state[challengeId].progress = progress;
    safeSet(KEYS.CHALLENGES, state);
  }

  completeChallenge(challengeId) {
    const state = this.getChallengesState();
    if (!state[challengeId]) return;
    state[challengeId].completed  = true;
    state[challengeId].completedAt = new Date().toISOString();
    safeSet(KEYS.CHALLENGES, state);

    const user = this.getUser();
    this.saveUser({ greenPoints: (user.greenPoints ?? 0) + 100 });
  }

  // ── Team ─────────────────────────────────────────────────────────────────

  getTeamData() {
    return safeGet(KEYS.TEAM);
  }

  saveTeamData(team) {
    safeSet(KEYS.TEAM, deepSanitize(team));
  }

  // ── Export / Import ───────────────────────────────────────────────────────

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

  clearAll() {
    Object.values(KEYS).forEach(safeRemove);
    this._init();
  }
}

// Singleton export
export const storage = new StorageManager();
