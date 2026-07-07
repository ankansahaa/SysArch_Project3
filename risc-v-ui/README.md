# React Rewrite

This folder contains a React rewrite of the original Play template + vanilla JS UI.

## Run

1. `cd rewrite`
2. `npm install`
3. `npm run dev`

## Production Docker

Build and run the frontend in a production container with Docker Compose:

1. `docker compose up --build -d`
2. Open `http://localhost:8080`

The frontend build bakes in the backend URL at build time, so set `VITE_SIMULATOR_BACKEND_URL` before building if the API is not at `http://localhost:9000`.

Example:

`VITE_SIMULATOR_BACKEND_URL=http://your-backend-host:9000 docker compose up --build -d`

The app expects the original backend endpoints to be available (for example from the Play app):

- `GET /get-current-state`
- `GET /get-available-configs`
- `POST /new-action`
- `POST /new-key`
- `POST /set-config`
- `WebSocket /socket`

By default, the frontend connects directly to `http://localhost:9000`.
You can override that with `VITE_SIMULATOR_BACKEND_URL` if the backend is hosted elsewhere.

Debug transport logging can be enabled with `VITE_SIMULATOR_DEBUG=true`.
When enabled, outbound/inbound WebSocket messages (and HTTP requests/responses) are logged in the browser console.

Examples:

- Default direct backend: `VITE_SIMULATOR_BACKEND_URL=http://localhost:9000`
- Alternate backend host: `VITE_SIMULATOR_BACKEND_URL=http://your-backend-host:9000`
- Enable debug transport logs: `VITE_SIMULATOR_DEBUG=true`

## Architecture

The rewrite is intentionally split into small modules by responsibility:

- `src/App.jsx`: thin composition root that wires top-level panels.
- `src/components/`: presentational UI components.
- `src/hooks/useSimulator.js`: orchestration hook for app state, controls, keyboard input, bootstrap, and socket reactions.
- `src/hooks/useTimedMessage.js`: reusable timed message behavior.
- `src/services/api.js`: HTTP client for backend endpoints.
- `src/services/socket.js`: WebSocket setup and heartbeat lifecycle.
- `src/state/simulatorModel.js`: pure state transformation logic (clone/build/apply/infer helpers).
- `src/constants/simulator.js`: shared constants and presets.
- `src/utils.js`: formatting and mapping utilities.

## Maintenance Guide

- Add or change backend calls in `src/services/api.js`.
- Add new socket events in `src/hooks/useSimulator.js`.
- Keep state derivation pure in `src/state/simulatorModel.js`.
- Keep components focused on rendering and simple callbacks only.
- Prefer extending existing modules over adding logic directly in `App.jsx`.
