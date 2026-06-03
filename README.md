# Steadyworks Bench — Website

Public site for the [Steadyworks 3D Design Benchmark](https://github.com/rasamheman/steadyworks-bench).

3×3 grid of CAD tasks. Click any task for the prompt, the input + reference + agent outputs (rendered in your browser via `<model-viewer>`), and a side-by-side comparison of Opus 4.7 vs Haiku 4.5.

## Stack

- **Next.js 14** (App Router, static export)
- **Tailwind CSS** for styling
- **`<model-viewer>`** (Google) for 3D rendering
- **build123d + trimesh** (Python) for STEP → GLB conversion at build time
- Deployed on **Vercel**

## Local development

```bash
npm install
npm run build:data      # walks ../<task>/ folders, converts STEP→GLB, aggregates run_summary.json
npm run dev             # localhost:3000
```

`build:data` requires `uvx` on PATH (used to run the STEP-to-GLB Python helper in an isolated env).

## Build for production

```bash
npm run build           # runs build:data first, then `next build` with static export → ./out
```

## Data flow

```
E:\Code\3D Benchmark\<task>\
├── instruction.md                   ─┐
├── task.toml                         │
├── environment\<input>.step          │
├── solution\<reference>.step         │ → scripts/build-data.mjs
└── jobs\<batch>\<trial>\             │   → data/tasks.json
    ├── run_summary.json              │   → public/models/<task>/*.glb
    └── artifacts\out.step            ─┘
```

Each task's row in `data/tasks.json` is consumed by the homepage grid and the per-task page.

## Deploy

Auto-deploys on push to `main` via Vercel. See `vercel.json` for build settings.
