# RutaSegura — Frontend

Web application of RutaSegura, the smart rural school transport system.
Built with React + TypeScript (Vite). The interface is in Spanish; the code is in English.

It talks to the [RutaSegura API](https://rutasegura-api-g7n4.onrender.com/docs).

## Screens by role
| Role | What they can do |
|---|---|
| Coordinator | Overview of the day and absences, students, routes and stops, trips, users, delay prediction |
| Driver | Schedule and start their trip, register boarding and drop-off by QR code or by tapping the student, finish the trip |
| Monitor | Register boarding and drop-off on trips in progress |
| Guardian | See where each child is today, the route and the boarding history |

The route of every trip is drawn as a road with its stops and the bus position
(`src/components/RouteLine.tsx`).

## Project structure
```
src/
  api.ts            HTTP client for the API (token, errors, slow-server notice)
  auth.tsx          Session: login, logout and current user
  format.ts         Spanish labels and Colombia-time formatting
  types.ts          Data shapes returned by the API
  useLoad.ts        Small data-loading hook
  components/       Layout, RouteLine, notices
  pages/            Login, coordinator/, driver/, guardian/
  styles.css        All styles
render.yaml         Render static-site configuration
```

## Run locally
Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env      # on Windows: copy .env.example .env
npm run dev
```
Open http://localhost:5173

`VITE_API_URL` in `.env` sets which API the app uses. By default it is the deployed API.

## Build
```bash
npm run build     # output in dist/
npm run preview   # serve the build locally
```

## Deploy (Render static site)
`render.yaml` defines a free static site that builds with `npm ci && npm run build`,
publishes `dist/`, and rewrites every path to `index.html` so page reloads work.
Create it on Render with **New → Blueprint** and select this repository.

## Demo accounts
| Role | E-mail | Password |
|---|---|---|
| Coordinator | admin@rutasegura.com | Admin123* |
| Driver | conductor@rutasegura.com | Conductor123* |
| Guardian | acudiente@rutasegura.com | Acudiente123* |
