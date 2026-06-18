# 🌍 EcoTrack — Carbon Footprint Awareness Platform

A premium, single-page web application that helps individuals **understand, track, and reduce** their carbon footprint through personalized insights, gamification, and social accountability.

## 🚀 Live Demo

> Deploy to Netlify or Vercel — see **Deployment** section below.

---

## ✨ Features

### 📊 Dashboard
- Real-time CO₂ stats (today / weekly / 30-day average)
- **Emotional context cards**: "Your emissions today equal charging 847 smartphones"
- Benchmark bars vs. Paris Agreement target (6.3 kg/day) and global average (12 kg/day)
- Interactive Chart.js visualizations (bar + doughnut)
- Today's activity log with delete controls

### 🌿 Living World (Gamification)
- **HTML5 Canvas animated world** that transforms in real-time based on your health score
- Score 90–100 → pristine blue sky, lush green trees, crystal-clear river, birds flying
- Score 50–70 → overcast sky, yellowing trees, murky water
- Score 0–30 → storm clouds, dead trees, toxic brown river, factory smoke particles
- World health is derived from your 30-day average daily CO₂

### ✏️ Activity Logger
- 5 categories: Transport, Food, Energy, Shopping, Travel
- **30+ emission types** with real-world CO₂ factors
- **Real-time nudges**: "Switching to metro for this 10 km trip saves 1.69 kg CO₂ (5.1× cleaner)"
- Live emission preview updates as you type the amount

### ✨ AI Insights (Gemini)
- Optional Gemini API key input (judge-friendly, stored locally only)
- **Personalised prompt engineering** — sends your actual stats to Gemini
- Falls back to intelligent rule-based insights when no key provided
- Shows: top emission category, actionable tip, weekly challenge, fun fact, micro-actions
- Clearly badges source: "✨ Gemini AI" or "📊 Rule-based"

### 🏆 Social Leaderboard
- Individual and team rankings
- Create or join a team (hostel floor, department, friend group)
- Green Score formula: `100 - (avgDailyKg / 20 × 100) + streakBonus`
- Medal icons for top 3 positions

### 🎯 Goals & Achievements
- 6 predefined carbon challenges with CO₂ saving estimates
- 10 achievement badges (First Log, Zero Hero, Week Warrior, Earth Defender, etc.)
- Progress rings and streak tracking

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Structure | Semantic HTML5 |
| Styling | Vanilla CSS with custom properties |
| Logic | ES6 Modules (no bundler) |
| Charts | Chart.js 4.x (CDN, SRI integrity) |
| Fonts | Google Fonts (Inter + Space Grotesk) |
| AI | Google Gemini 1.5 Flash API |
| Storage | LocalStorage (schema-validated) |
| Animation | HTML5 Canvas + requestAnimationFrame |

---

## 📁 Project Structure

```
├── index.html              # Main SPA entry point
├── css/
│   └── styles.css          # Full design system (28 sections, 600+ lines)
├── js/
│   ├── app.js              # SPA controller & event wiring
│   ├── data.js             # Emission factors, equivalences, achievements
│   ├── storage.js          # Secure LocalStorage manager
│   ├── tracker.js          # Emission calculation engine
│   ├── world.js            # Living World canvas animation
│   ├── charts.js           # Chart.js wrappers
│   ├── social.js           # Leaderboard & team management
│   ├── insights.js         # Gemini AI integration
│   ├── accessibility.js    # A11y utilities (ARIA, focus, toasts)
│   └── tests.js            # Unit test suite
└── README.md
```

---

## 🔐 Security

- **No API keys hardcoded** anywhere in the codebase
- Content Security Policy meta tag restricts script sources
- All user inputs sanitized (XSS-safe) before LocalStorage writes
- API key masked with password input + toggle visibility
- SRI hash on Chart.js CDN script

---

## ♿ Accessibility

- WCAG 2.1 AA target
- Semantic HTML5 (`<nav>`, `<main>`, `<section>`, `<article>`, `<header>`)
- ARIA roles, labels, and live regions throughout
- Skip-to-main-content link
- Full keyboard navigation with Alt+key shortcuts
- Modal focus trapping
- `prefers-reduced-motion` respected in canvas and CSS animations
- Colour contrast ratio ≥ 4.5:1 for all text

---

## 🧪 Testing

Open the **Goals** section → click **"Run Unit Tests"** to run 30+ unit tests covering:

- Emission calculations (all categories)
- Edge cases (invalid inputs, negatives, unknown types)
- World health score mapping
- Transport nudge generation
- Storage sanitization & persistence
- Emotional context tiers
- Equivalence string generation

---

## 🚀 Deployment

### Netlify (recommended — 2 steps)
```bash
# 1. Push to GitHub
git init && git add . && git commit -m "feat: EcoTrack platform"
git remote add origin https://github.com/YOUR_USER/ecotrack.git
git push -u origin main

# 2. Connect repo to Netlify
# → netlify.com → New site from Git → select repo → deploy
# No build command needed — static files only
```

### Vercel
```bash
vercel deploy --prod
# No configuration needed
```

### GitHub Pages
```bash
# In repo Settings → Pages → Source: main branch / root
```

---

## 💡 Usage Tips

1. **Log activities daily** to build your streak and watch the world transform
2. **Get a free Gemini API key** at [aistudio.google.com](https://aistudio.google.com) for personalised AI insights
3. **Create a team** and share the team name with friends/colleagues to compete
4. **Keyboard shortcuts**: Alt+D (Dashboard), Alt+W (World), Alt+L (Logger), Alt+I (Insights), Alt+S (Social), Alt+G (Goals)

---

## 📊 Emission Data Sources

- **Transport**: IPCC AR6 Working Group III (2022)
- **Food**: Poore & Nemecek, *Science* 2018 / Our World in Data
- **Electricity**: CEA India Grid Emission Factor 2023 (0.82 kg CO₂/kWh)
- **General factors**: DEFRA UK GHG Conversion Factors 2023

---

## 📜 License

MIT License — free to use, modify, and distribute.
