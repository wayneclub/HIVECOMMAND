# HIVECOMMAND

**HIVECOMMAND** is an AI-assisted voice command interface designed to reduce operator cognitive load and enable effective supervision and coordination of multi-drone (up to 4-drone) swarms with clear decision authority.

This prototype was developed as part of [USC's Hacking 4 Defense (H4D) — Navy 191](info/Navy%20191%20SIT%20BACK%20AND%20OPERATE%20Problem%20Statement.pdf) program in collaboration with the **U.S. Navy**, addressing the challenge of cognitive overload among UAV operators. HIVECOMMAND explores improved operator–swarm interaction through a streamlined control experience and clearer command authorization workflows.

> Development was supported using tools such as ChatGPT, Antigravity, Codex, and Claude. Wireframes were created using Figma Design, Figma Make, and Google Stitch.

---

## Live Demo

**[https://wayneclub.github.io/HIVECOMMAND/](https://wayneclub.github.io/HIVECOMMAND/)**

| Field | Value |
|---|---|
| Username | `observer.sierra` |
| Password | `123456` |

---

## Overview

Modern drone operators face significant cognitive overload when supervising multiple UAVs simultaneously. HIVECOMMAND tackles this by providing:

- **Voice-first command input** — operators issue natural-language commands captured and parsed by an on-device AI model
- **AI-parsed command review** — voice input is transcribed and interpreted before execution, giving operators a confirmation step
- **Dual-role authority model** — clear separation between Operator and Commander roles with approval workflows for high-stakes actions
- **Live swarm monitoring** — real-time map visualization of drone positions, altitude, speed, and mission status
- **Mission post-mortem** — structured debrief view for reviewing completed mission events

---

## Key Features

| Feature | Description |
|---|---|
| Voice Command Capture | In-browser speech recognition via `VoiceControlFAB` and `VoiceCaptureModal` |
| AI Command Parsing | On-device NLP using `@xenova/transformers` for intent extraction |
| Operator Dashboard | Default situational awareness view with swarm status and map |
| Attack Monitor | Live drone telemetry during active engagement phase |
| Commander Approval | High-authority actions require Commander sign-off before execution |
| Commander Monitor | Detailed swarm oversight panel for mission commanders |
| Mission Post-Mortem | Structured timeline review after mission completion |
| RBAC Settings | Role-based access control configuration for Operator / Commander personas |
| Map Visualization | 3D geospatial map powered by deck.gl + MapLibre GL |
| Mission Simulation | Physics-based swarm simulation (climb/descent rates, formation follow, wind) |
| Supabase Integration | Mission history persistence via Supabase backend |

---

## Tech Stack

- **Frontend:** React 19 + Vite 5
- **Maps:** deck.gl 9, MapLibre GL 5, react-map-gl, react-leaflet
- **AI / NLP:** @xenova/transformers (on-device, no API key required)
- **Backend / Storage:** Supabase (PostgreSQL + Realtime)
- **Deployment:** GitHub Actions → GitHub Pages

---

## Application Screens

```
Screen 1  — Operator Default (situational awareness dashboard)
Screen 2  — Voice Capture Modal (speech input)
Screen 3  — AI Parsed Review (command confirmation before execution)
Screen 4  — Operator Attack Monitor (live engagement telemetry)
Screen 6  — Commander Approval (authorization workflow)
Screen 7  — Commander Detailed Monitor (full swarm oversight)
Screen 8  — Mission Post-Mortem (debrief & event timeline)
Screen 9  — RBAC Settings (role & permission configuration)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
# Output is in dist/
```

---

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that builds and publishes automatically on every push to `main`.

### First-time setup

1. Push this repo to GitHub under the name `HIVECOMMAND`.
2. Go to **Settings → Pages**.
3. Set the source to **GitHub Actions**.
4. Push to `main` — the workflow will build and deploy automatically.

The live site will be available at:
```
https://<your-username>.github.io/HIVECOMMAND/
```

> If you rename the repository, update `base` in [`vite.config.js`](vite.config.js) to match.

---

## Project Structure

```
hivecommand/
├── public/
│   ├── videos/          # Drone feed video assets (drone-1..5.mp4)
│   └── icons.svg
├── src/
│   ├── views/           # Full-screen application screens
│   │   ├── OperatorDefault.jsx
│   │   ├── VoiceCaptureModal.jsx
│   │   ├── AIParsedReview.jsx
│   │   ├── OperatorAttackMonitor.jsx
│   │   ├── CommanderApproval.jsx
│   │   ├── CommanderDetailedMonitor.jsx
│   │   ├── MissionPostMortem.jsx
│   │   └── RBACSettings.jsx
│   ├── components/      # Shared UI components
│   │   ├── Sidebar.jsx
│   │   ├── TopNav.jsx
│   │   ├── DeckGLMap.jsx
│   │   └── VoiceControlFAB.jsx
│   ├── context/
│   │   └── MissionContext.jsx   # Global mission state & swarm simulation
│   └── lib/
│       ├── missionHistoryStore.js
│       └── supabase.js
├── .github/workflows/
│   └── deploy.yml       # GitHub Pages CI/CD
├── vite.config.js
└── index.html
```

---

## Environment Variables

Create a `.env` file at the project root (see [`.env.example`](.env.example)):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Background

HIVECOMMAND was built for USC's **[Hacking 4 Defense (H4D) — Navy 191](info/Navy%20191%20SIT%20BACK%20AND%20OPERATE%20Problem%20Statement.pdf)** program — a problem-solving course that pairs student teams with U.S. defense and national security sponsors using Lean Startup methodology. This project's sponsor challenge came from the **U.S. Navy**, focusing on reducing cognitive overload for operators supervising autonomous drone swarms in contested environments.

The prototype demonstrates a design-first approach: wireframes defined the interaction model before implementation, ensuring the UX stayed grounded in operator needs rather than technical constraints.

---

## License

This project is a research prototype developed for academic and demonstration purposes as part of the USC H4D program.
