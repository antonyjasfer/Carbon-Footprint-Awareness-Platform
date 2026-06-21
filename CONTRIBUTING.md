# Contributing to EcoTrack — Carbon Footprint Awareness Platform

Thank you for your interest in improving EcoTrack! This guide describes how to set up the project locally and the conventions we follow.

---

## 📋 Prerequisites

- Node.js ≥ 18.0.0
- A modern browser (Chrome 105+, Firefox 100+, Safari 16+, Edge 105+)
- Git

---

## 🚀 Local Development

```bash
# Clone the repository
git clone https://github.com/antonyjasfer/Carbon-Footprint-Awareness-Platform.git
cd Carbon-Footprint-Awareness-Platform

# Serve locally (no build step needed — pure ES modules)
npm start
# → Open http://localhost:3000
```

---

## 🏗️ Project Structure

```
├── index.html          # SPA entry point — all sections are rendered here
├── css/
│   └── styles.css      # Design system (custom properties, components, utilities)
├── js/
│   ├── app.js          # Main controller — routes events to modules
│   ├── data.js         # Emission factors, constants, static data
│   ├── storage.js      # Secure LocalStorage manager (singleton)
│   ├── tracker.js      # Calculation engine — emissions, stats, forecasting
│   ├── world.js        # HTML5 Canvas Living World animation
│   ├── charts.js       # Chart.js wrappers + Carbon Heatmap
│   ├── social.js       # Leaderboard scoring and team management
│   ├── insights.js     # Gemini AI integration + rule-based fallback
│   ├── accessibility.js # ARIA utilities, focus trap, toasts, keyboard shortcuts
│   └── tests.js        # Browser-native unit test suite (no test runner needed)
├── firebase.json       # Firebase Hosting config
├── .firebaserc         # Firebase project alias
├── .eslintrc.json      # ESLint configuration
└── package.json        # Project metadata and npm scripts
```

---

## 🧪 Running Tests

Open the app in a browser, navigate to **Goals**, and click **"Run Unit Tests"**.

Test output appears in the panel below the button and also in the DevTools console.

---

## 📝 Code Style

- **ES2022 modules** — `import`/`export`, no CommonJS `require()`
- **JSDoc** on all exported functions — `@param`, `@returns`, `@throws`
- **No magic numbers** — use named constants from `js/data.js`
- **No `var`** — use `const` and `let`
- **Strict equality** — always `===`, never `==`
- **Error handling** — wrap all `async` calls in `try/catch`; never swallow errors silently
- **Security** — never use `innerHTML` with unsanitised user input; use `storage.deepSanitize()`
- **Line length** — max 120 characters
- **Function length** — max ~80 lines; extract helpers for longer logic

---

## 🔐 Security Rules

1. **No API keys in source code** — keys are read from `localStorage` at call-time only
2. **All user input must be sanitised** before storage (use `sanitize()` in `storage.js`)
3. **No `eval()`**, `new Function()`, or dynamic code execution
4. **Content Security Policy** is enforced via the meta tag in `index.html`
5. **API key input** must be `type="password"` in HTML

---

## 🌿 Emission Data Sources

| Category | Source |
|----------|--------|
| Transport | IPCC AR6 Working Group III (2022) |
| Food | Poore & Nemecek, *Science* (2018) / Our World in Data |
| Electricity | CEA India Grid Emission Factor 2023 (0.82 kg CO₂/kWh) |
| General | DEFRA UK GHG Conversion Factors 2023 |

---

## 📬 Pull Request Guidelines

1. Branch from `main` — `git checkout -b feat/your-feature`
2. Keep commits atomic and descriptive: `feat:`, `fix:`, `chore:`, `docs:`
3. Ensure all existing tests still pass
4. Add tests for any new calculation logic
5. Update the README if behaviour changes

---

## ❓ Questions

Open an issue or start a discussion in the GitHub repository.
