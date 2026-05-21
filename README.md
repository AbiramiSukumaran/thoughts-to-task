# Thoughts to Task (Capturing & Structure Engine)

A high-performance command-center web application designed to turn chaotic, stream-of-consciousness thoughts into polished, actionable subroutines and structured checkmarks. 

Built using a state-of-the-art client-server architecture with **React 19 / Vite**, **Express**, **esbuild**, **Firebase**, and **Gemini AI SDK**, this system features a stunning high-contrast minimalist slate interface designed for rapid capture without cognitive distraction.

---

## Key Features

- **Omni-Capture Input**: Enter unfiltered brainstorms or stream-of-consciousness raw notes with instantaneous feedback.
- **Task Structuring Engine**: Transform scattered thoughts into highly-organized nested task checklists using advanced language modeling via the **Google Gen AI SDK**.
- **Secure Cloud Sync**: Seamlessly sync lists across screens with real-time Firebase Auth and Firestore Cloud Storage.
- **Zero-Friction UI**: Fluid micro-animations powered by `motion`, crisp vector iconography via `lucide-react`, and elegant custom typography.

---

## Architectural Tech Stack

- **Frontend**: React 19, Tailwind CSS, Lucide Icons, and Motion animations.
- **Backend**: Express web server configured dynamically for seamless development hot-reloading and production bundling.
- **Database / Auth**: Firestore NoSQL database and secure Google/Email Authentication via Firebase Web SDK.
- **Production Packager**: Bundled into a optimized standalone CommonJS build (`dist/server.cjs`) using `esbuild`.
- **Environment**: Containerized with full port-adaptive configurations optimized for instant deployment to Google Cloud Run or local systems.

---

## Directory Structure

```text
├── src/                    # Front-end React Application
│   ├── App.tsx             # Interactive application layout & client logic
│   ├── firebase.ts         # Secure Firebase DB & authentication setup
│   ├── index.css           # Styling setup (Tailwind CSS variables & Display Fonts)
│   ├── main.tsx            # Main application mounting registry
│   └── types.ts            # Key data structures and task types
├── server.ts               # Full-stack API Gateway & SPA server
├── Dockerfile              # Docker Container assembly parameters
├── .dockerignore           # Excluded workspace patterns for builder efficiency
├── package.json            # Node.js dependencies, linting, and build pipeline
└── README.md               # Product documentation
```

---

## Quickstart Guide

### 1. Prerequisite Accounts
- Ensure you have a **Firebase Project** configured with Authentication and Firestore enabled.
- Ensure you have a **Google Gemini API Key** derived from Google AI Studio.

### 2. File Initialization
Copy the template configuration pattern and create your local variables setup:
```bash
cp .env.example .env
```
Fill in the credentials:
- `GEMINI_API_KEY`: Your Google AI Studio API Secret.
- `APP_URL`: Your development server link (e.g. `http://localhost:3000`).

### 3. Installation
Populate your `node_modules` dependencies:
```bash
npm install
```

### 4. Running the Development Server
Launches the full-stack system with TS execution engine (`tsx`) on port 3000:
```bash
npm run dev
```

### 5. Production Compilation & Launch
Vite builds the static assets, while `esbuild` bundles the server into a fast-loading artifact:
```bash
# Build the production files
npm run build

# Start the optimized Node service
npm run start
```


