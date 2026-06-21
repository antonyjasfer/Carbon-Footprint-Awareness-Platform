/**
 * @module data
 * @description Emission factors (kg CO₂e), human-readable equivalences,
 *              achievement definitions, and challenge data for the Carbon
 *              Footprint Awareness Platform.
 *
 * Sources:
 *  - IPCC AR6 (transport)
 *  - Our World in Data / Poore & Nemecek 2018 (food)
 *  - CEA India grid emission factor 2023 (electricity)
 *  - DEFRA UK conversion factors 2023 (general)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Emission Factors (kg CO₂e per unit)
// ─────────────────────────────────────────────────────────────────────────────

export const EMISSION_FACTORS = {
  transport: {
    car_petrol:   { factor: 0.21,  unit: 'km',      label: 'Car (Petrol)',   icon: '🚗', color: '#ef4444' },
    car_diesel:   { factor: 0.17,  unit: 'km',      label: 'Car (Diesel)',   icon: '🚗', color: '#f97316' },
    car_electric: { factor: 0.05,  unit: 'km',      label: 'Car (Electric)', icon: '🔋', color: '#22c55e' },
    motorcycle:   { factor: 0.11,  unit: 'km',      label: 'Motorcycle',     icon: '🏍️', color: '#f59e0b' },
    bus:          { factor: 0.089, unit: 'km',      label: 'Bus',            icon: '🚌', color: '#84cc16' },
    metro:        { factor: 0.041, unit: 'km',      label: 'Metro / Train',  icon: '🚇', color: '#10b981' },
    bicycle:      { factor: 0,     unit: 'km',      label: 'Bicycle',        icon: '🚲', color: '#06b6d4' },
    walking:      { factor: 0,     unit: 'km',      label: 'Walking',        icon: '🚶', color: '#06b6d4' },
    auto_rickshaw:{ factor: 0.092, unit: 'km',      label: 'Auto Rickshaw',  icon: '🛺', color: '#fbbf24' },
    cab_shared:   { factor: 0.106, unit: 'km',      label: 'Shared Cab',     icon: '🚕', color: '#fb923c' },
  },
  food: {
    beef:         { factor: 27.0,  unit: 'serving', label: 'Beef',           icon: '🥩', color: '#dc2626', servingKg: 0.15 },
    pork:         { factor: 12.0,  unit: 'serving', label: 'Pork',           icon: '🥓', color: '#f97316', servingKg: 0.15 },
    chicken:      { factor: 6.9,   unit: 'serving', label: 'Chicken',        icon: '🍗', color: '#f59e0b', servingKg: 0.15 },
    fish:         { factor: 6.1,   unit: 'serving', label: 'Fish/Seafood',   icon: '🐟', color: '#0ea5e9', servingKg: 0.15 },
    dairy:        { factor: 3.2,   unit: 'serving', label: 'Dairy (milk/cheese)', icon: '🥛', color: '#a3a3a3', servingKg: 0.2 },
    eggs:         { factor: 4.8,   unit: 'serving', label: 'Eggs',           icon: '🥚', color: '#fcd34d', servingKg: 0.05 },
    rice:         { factor: 2.7,   unit: 'serving', label: 'Rice',           icon: '🍚', color: '#86efac', servingKg: 0.2 },
    vegetables:   { factor: 2.0,   unit: 'serving', label: 'Vegetables',     icon: '🥦', color: '#22c55e', servingKg: 0.2 },
    bread:        { factor: 1.2,   unit: 'serving', label: 'Bread / Grains', icon: '🍞', color: '#d97706', servingKg: 0.1 },
    legumes:      { factor: 0.9,   unit: 'serving', label: 'Legumes / Lentils', icon: '🫘', color: '#84cc16', servingKg: 0.2 },
    fruits:       { factor: 0.7,   unit: 'serving', label: 'Fruits',         icon: '🍎', color: '#f43f5e', servingKg: 0.2 },
    coffee:       { factor: 2.1,   unit: 'cup',     label: 'Coffee (cup)',   icon: '☕', color: '#92400e', servingKg: null },
    delivery_meal:{ factor: 4.2,   unit: 'order',   label: 'Food Delivery Order', icon: '🛵', color: '#8b5cf6', servingKg: null },
  },
  energy: {
    electricity:  { factor: 0.82,  unit: 'kWh',     label: 'Electricity',    icon: '⚡', color: '#fbbf24' },
    natural_gas:  { factor: 2.04,  unit: 'm³',      label: 'Natural Gas',    icon: '🔥', color: '#f97316' },
    lpg:          { factor: 1.51,  unit: 'liter',   label: 'LPG / Cooking Gas', icon: '🍳', color: '#fb923c' },
    ac_hour:      { factor: 0.9,   unit: 'hour',    label: 'Air Conditioning (1hr)', icon: '❄️', color: '#67e8f9' },
    heater_hour:  { factor: 0.7,   unit: 'hour',    label: 'Electric Heater (1hr)',  icon: '🌡️', color: '#fca5a5' },
  },
  shopping: {
    clothing_new:    { factor: 8.0,  unit: 'item',    label: 'New Clothing Item',  icon: '👕', color: '#c084fc' },
    shoes:           { factor: 14.0, unit: 'pair',    label: 'New Shoes',          icon: '👟', color: '#a78bfa' },
    smartphone:      { factor: 70.0, unit: 'item',    label: 'Smartphone',         icon: '📱', color: '#60a5fa' },
    laptop:          { factor: 300.0,unit: 'item',    label: 'Laptop',             icon: '💻', color: '#3b82f6' },
    furniture_piece: { factor: 44.0, unit: 'item',    label: 'Furniture Piece',    icon: '🛋️', color: '#a16207' },
    online_delivery: { factor: 0.5,  unit: 'package', label: 'Online Package',     icon: '📦', color: '#fb923c' },
    plastic_bottle:  { factor: 0.08, unit: 'bottle',  label: 'Plastic Bottle',     icon: '🧴', color: '#2dd4bf' },
  },
  travel: {
    flight_domestic: { factor: 0.255, unit: 'km', label: 'Domestic Flight',     icon: '✈️', color: '#f43f5e' },
    flight_intl:     { factor: 0.195, unit: 'km', label: 'International Flight', icon: '🌍', color: '#dc2626' },
    train_long:      { factor: 0.041, unit: 'km', label: 'Long Train Journey',   icon: '🚂', color: '#22c55e' },
    bus_intercity:   { factor: 0.068, unit: 'km', label: 'Intercity Bus',        icon: '🚌', color: '#84cc16' },
    hotel_night:     { factor: 31.5,  unit: 'night', label: 'Hotel Stay (1 night)', icon: '🏨', color: '#8b5cf6' },
    cruise_day:      { factor: 160.0, unit: 'day',   label: 'Cruise (per day)',   icon: '🚢', color: '#0ea5e9' },
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable CO₂ Equivalences (per kg CO₂e)
// ─────────────────────────────────────────────────────────────────────────────

export const EQUIVALENCES = [
  { multiplier: 122,  unit: 'smartphones', text: 'smartphone charges', icon: '📱' },
  { multiplier: 4.7,  unit: 'km',          text: 'km driven by average car', icon: '🚗' },
  { multiplier: 0.05, unit: 'trees/year',  text: 'trees needed a full year to absorb this', icon: '🌳' },
  { multiplier: 2.5,  unit: 'burgers',     text: 'beef burgers in carbon cost', icon: '🍔' },
  { multiplier: 0.42, unit: 'flights',     text: 'km of domestic flight', icon: '✈️' },
  { multiplier: 1.22, unit: 'kWh',         text: 'hours of a 60W light bulb', icon: '💡' },
  { multiplier: 0.5,  unit: 'balloons',    text: 'balloons of CO₂ gas', icon: '🎈' },
];

/**
 * Generates a human-readable equivalence string for a given CO₂ amount.
 * @param {number} kgCO2 - kg of CO₂e
 * @returns {string} - readable string e.g. "charging 122 smartphones"
 */
export function getEquivalence(kgCO2) {
  if (kgCO2 <= 0) {return 'zero emissions — perfect! 🌿';}
  // Pick a contextually interesting equivalence
  const eq = EQUIVALENCES[Math.floor(kgCO2 * 7) % EQUIVALENCES.length];
  const value = (kgCO2 * eq.multiplier).toFixed(1);
  return `${value} ${eq.text} ${eq.icon}`;
}

/**
 * Returns the emotional context message for a daily total.
 * @param {number} kgCO2 - daily kg CO₂e
 * @returns {{ label: string, color: string, emoji: string }}
 */
export function getEmotionalContext(kgCO2) {
  if (kgCO2 === 0)  {return { label: 'Carbon-free day!',     color: '#06b6d4', emoji: '🌊', tier: 'hero'    };}
  if (kgCO2 < 2)   {return { label: 'Outstanding',           color: '#10b981', emoji: '🌟', tier: 'hero'    };}
  if (kgCO2 < 5)   {return { label: 'Great',                 color: '#22c55e', emoji: '😊', tier: 'good'    };}
  if (kgCO2 < 8)   {return { label: 'Average',               color: '#84cc16', emoji: '😐', tier: 'average' };}
  if (kgCO2 < 12)  {return { label: 'Above average',         color: '#f59e0b', emoji: '😟', tier: 'warn'    };}
  if (kgCO2 < 20)  {return { label: 'High impact',           color: '#f97316', emoji: '⚠️', tier: 'high'    };}
  return               { label: 'Very high impact',      color: '#ef4444', emoji: '🔥', tier: 'critical' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Nudge Messages
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSPORT_ALTERNATIVES = {
  car_petrol:  ['metro', 'bus', 'bicycle', 'walking'],
  car_diesel:  ['metro', 'bus', 'bicycle', 'walking'],
  cab_shared:  ['metro', 'bus', 'bicycle'],
  motorcycle:  ['metro', 'bus', 'bicycle', 'walking'],
  auto_rickshaw: ['metro', 'bus'],
};

/**
 * Generates a nudge comparing chosen transport to a greener alternative.
 * @param {string} chosenMode - key in EMISSION_FACTORS.transport
 * @param {number} distanceKm
 * @returns {{ message: string, savings: number } | null}
 */
export function getTransportNudge(chosenMode, distanceKm) {
  const alternatives = TRANSPORT_ALTERNATIVES[chosenMode];
  if (!alternatives || distanceKm <= 0) {return null;}

  const chosenFactor = EMISSION_FACTORS.transport[chosenMode]?.factor ?? 0;
  const bestAlt = alternatives[0]; // First is greenest
  const altFactor = EMISSION_FACTORS.transport[bestAlt]?.factor ?? 0;
  const altLabel  = EMISSION_FACTORS.transport[bestAlt]?.label ?? bestAlt;

  const savings = (chosenFactor - altFactor) * distanceKm;
  if (savings <= 0) {return null;}

  const ratio = chosenFactor > 0 ? (chosenFactor / Math.max(altFactor, 0.001)).toFixed(1) : 1;

  return {
    message: `Switching to ${altLabel} for this ${distanceKm} km trip saves ${savings.toFixed(2)} kg CO₂ (${ratio}× cleaner)`,
    savings,
    alternative: bestAlt,
    altLabel,
    ratio: parseFloat(ratio),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievements / Badges
// ─────────────────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'first_log',
    icon: '🌱',
    title: 'First Step',
    description: 'Logged your first activity',
    condition: (stats) => stats.totalLogs >= 1,
    rarity: 'common',
  },
  {
    id: 'green_day',
    icon: '🌿',
    title: 'Green Day',
    description: 'Kept daily emissions under 3 kg CO₂',
    condition: (stats) => stats.bestDayKg <= 3,
    rarity: 'common',
  },
  {
    id: 'carbon_zero',
    icon: '💎',
    title: 'Zero Hero',
    description: 'Logged a carbon-free day',
    condition: (stats) => stats.zeroDays >= 1,
    rarity: 'rare',
  },
  {
    id: 'streak_7',
    icon: '🔥',
    title: 'Week Warrior',
    description: '7-day logging streak',
    condition: (stats) => stats.currentStreak >= 7,
    rarity: 'uncommon',
  },
  {
    id: 'streak_30',
    icon: '⚡',
    title: 'Month Master',
    description: '30-day logging streak',
    condition: (stats) => stats.currentStreak >= 30,
    rarity: 'epic',
  },
  {
    id: 'metro_rider',
    icon: '🚇',
    title: 'Metro Rider',
    description: 'Used metro/train 10 times',
    condition: (stats) => (stats.transportCounts?.metro ?? 0) >= 10,
    rarity: 'uncommon',
  },
  {
    id: 'plant_based',
    icon: '🥦',
    title: 'Plant Powered',
    description: 'Chose plant-based meals 5 days running',
    condition: (stats) => stats.plantBasedStreak >= 5,
    rarity: 'uncommon',
  },
  {
    id: 'team_top',
    icon: '🏆',
    title: 'Team Champion',
    description: 'Reached #1 on your team leaderboard',
    condition: (stats) => stats.teamRank === 1,
    rarity: 'epic',
  },
  {
    id: 'low_emission_week',
    icon: '🌍',
    title: 'Earth Defender',
    description: 'Kept weekly emissions under 25 kg CO₂',
    condition: (stats) => stats.bestWeekKg <= 25,
    rarity: 'rare',
  },
  {
    id: 'hundred_logs',
    icon: '📊',
    title: 'Data Champion',
    description: 'Logged 100 activities',
    condition: (stats) => stats.totalLogs >= 100,
    rarity: 'epic',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Challenges
// ─────────────────────────────────────────────────────────────────────────────

export const CHALLENGES = [
  {
    id: 'no_meat_week',
    icon: '🥗',
    title: 'Plant-Based Week',
    description: 'Go meat-free for 7 days',
    target: 7,
    unit: 'days',
    category: 'food',
    reward: 'Plant Powered badge',
    co2Saving: 21.0,
  },
  {
    id: 'public_transport',
    icon: '🚇',
    title: 'Transit Challenge',
    description: 'Use only public transport for 5 days',
    target: 5,
    unit: 'days',
    category: 'transport',
    reward: 'Metro Rider badge',
    co2Saving: 8.5,
  },
  {
    id: 'no_ac',
    icon: '🌡️',
    title: 'Stay Cool Naturally',
    description: 'Avoid AC for 3 days',
    target: 3,
    unit: 'days',
    category: 'energy',
    reward: '50 Green Points',
    co2Saving: 5.4,
  },
  {
    id: 'walk_10km',
    icon: '🚶',
    title: 'Step It Up',
    description: 'Walk at least 10 km this week',
    target: 10,
    unit: 'km',
    category: 'transport',
    reward: '30 Green Points',
    co2Saving: 2.1,
  },
  {
    id: 'no_delivery',
    icon: '🍱',
    title: 'Cook at Home Week',
    description: 'No food deliveries for 7 days',
    target: 7,
    unit: 'days',
    category: 'food',
    reward: '40 Green Points',
    co2Saving: 29.4,
  },
  {
    id: 'zero_waste_day',
    icon: '♻️',
    title: 'Zero Waste Day',
    description: 'Log a day with under 1 kg CO₂',
    target: 1,
    unit: 'day',
    category: 'general',
    reward: 'Zero Hero badge',
    co2Saving: 7.0,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sample social / leaderboard seed data
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_TEAMS = [
  { id: 'hostel_a', name: 'Hostel A', avatar: '🏠', members: 12, weeklyKg: 340, score: 82 },
  { id: 'hostel_b', name: 'Hostel B', avatar: '🏡', members: 15, weeklyKg: 410, score: 74 },
  { id: 'eng_dept',  name: 'Engineering Dept.', avatar: '⚙️', members: 28, weeklyKg: 760, score: 71 },
  { id: 'design_dept',name: 'Design Dept.', avatar: '🎨', members: 10, weeklyKg: 220, score: 88 },
  { id: 'mba_batch', name: 'MBA Batch 2026', avatar: '📚', members: 20, weeklyKg: 590, score: 67 },
];

export const SAMPLE_INDIVIDUALS = [
  { id: 'usr_1', name: 'Aarav S.', avatar: '👨‍💻', weeklyKg: 18.2, streak: 14, score: 94, team: 'design_dept' },
  { id: 'usr_2', name: 'Priya M.', avatar: '👩‍🎓', weeklyKg: 21.4, streak: 9,  score: 91, team: 'hostel_a'   },
  { id: 'usr_3', name: 'Rahul K.', avatar: '🧑‍🔬', weeklyKg: 24.8, streak: 21, score: 88, team: 'eng_dept'   },
  { id: 'usr_4', name: 'Sneha P.', avatar: '👩‍💼', weeklyKg: 28.1, streak: 5,  score: 84, team: 'mba_batch'  },
  { id: 'usr_5', name: 'Dev R.',   avatar: '🧑‍🎨', weeklyKg: 31.5, streak: 3,  score: 79, team: 'hostel_b'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Global average daily carbon footprint (kg CO₂e) — for context
// ─────────────────────────────────────────────────────────────────────────────

export const GLOBAL_AVG_DAILY_KG = 12.0;  // World average
export const INDIA_AVG_DAILY_KG  = 5.0;   // India average
export const PARIS_TARGET_DAILY  = 6.3;   // Paris Agreement 2030 target
export const HERO_TARGET_DAILY   = 3.0;   // Our platform "hero" target

// ─────────────────────────────────────────────────────────────────────────────
// Category metadata
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = {
  transport: { label: 'Transport',  icon: '🚗', color: '#ef4444' },
  food:      { label: 'Food',       icon: '🍔', color: '#f59e0b' },
  energy:    { label: 'Energy',     icon: '⚡', color: '#fbbf24' },
  shopping:  { label: 'Shopping',   icon: '🛍️', color: '#8b5cf6' },
  travel:    { label: 'Travel',     icon: '✈️', color: '#3b82f6' },
};
