# RutaSegura — Frontend

Web application of RutaSegura, the smart rural school transport system.
Built with React + TypeScript (Vite). The interface is in Spanish; the code is in English.

It talks to the [RutaSegura API](https://rutasegura-api-g7n4.onrender.com/docs).

## Screens by role
| Role | What they can do |
|---|---|
| Coordinator | Overview with buses on the map and attendance chart, students (AVL search, guardians, printable QR ID card), routes (map, segments, Dijkstra, outbound/return, AI optimization), trips (schedule and follow live), users, fleet and licenses, catalogs (add weather / road conditions), AI, incidents, data structures, audit |
| Driver / monitor | Start the trip choosing weather and road (or detect the weather by GPS), see the AI delay estimate, share the bus GPS, scan ID cards with the camera, boarding queue, undo, report incidents, work without internet and sync later, finish |
| Guardian | Where each child is, the bus on the map in real time, arrival time to the child's stop, history, absence risk, notifications |

## Security
- The password is turned into `SHA-256(email:password)` in the browser (`src/crypto.ts`) before it is sent; the real password never travels and is never stored.
- Password fields are always masked, cannot be copied and accept at most 64 characters; new passwords must meet the policy (8–64 characters, upper and lower case, number, symbol, no spaces).
- Every form is validated with the same regular expressions as the API (`src/validation.ts`), with length limits and blocked characters.
- The session lasts 30 minutes: the countdown is shown in the top bar and the app logs out by itself (`src/auth.tsx`). The token lives in `sessionStorage`, so closing the tab ends the session.
- Option lists (roles, weather, road, grades…) come from the database catalogs, not from the code.

## Libraries
| Library | Use |
|---|---|
| leaflet | Map with OpenStreetMap tiles |
| jsqr | Read QR codes from the camera |
| qrcode | Draw the QR of the student ID card |

## Project structure
```
src/
  api.ts            HTTP client (all endpoints)
  auth.tsx          Session, 30-minute expiry and catalogs
  crypto.ts         SHA-256 of the password
  validation.ts     Regular expressions and password policy
  hooks.ts          Data loading, polling, GPS and offline queue
  format.ts         Colombia time and Spanish labels
  components/       Layout, fields, map, QR scanner, QR card, charts, route line
  pages/            Login, notifications, coordinator/, driver/, guardian/
```

## Run locally
```
npm install
copy .env.example .env
npm run dev
```
Open http://localhost:5173. The camera and GPS need HTTPS (or localhost).

## Deployment
`render.yaml` publishes the static site on Render (`npm ci && npm run build`, folder `dist`).
