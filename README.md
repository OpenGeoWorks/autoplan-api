# AutoPlan API

Backend API for **AutoPlan**, a web application for processing geospatial data in engineering
and cadastral surveys. It manages users, projects, and survey plans; runs the surveying
computations (traverse, area, differential leveling); and delegates the actual plan drawing
to the companion Python service ([autoplan-python](https://github.com/OpenGeoWorks/autoplan-python)),
which produces DXF/DWG/PDF bundles that can be edited in AutoCAD.

Built with TypeScript, Express 5, MongoDB (Mongoose), and Redis.

## Architecture

The codebase is a modular monolith: one folder per feature under `src/modules`, each owning
its routes, validation, controller, service (business logic), Mongoose model, and repository.

```
src/
├── app.ts                  Express app: middleware, routes, error handling
├── server.ts               Bootstrap: DB/Redis connections, graceful shutdown
├── config/                 Environment, MongoDB, and Redis setup
├── db/                     Generic repository (soft deletes, ownership scoping) + query helpers
├── middlewares/            Authentication, request logging, global error handler
├── routes/index.ts         Mounts every module router under /api/v1
├── services/               External integrations (AWS SES email)
├── templates/              Email templates (Handlebars)
├── utils/                  Logger, errors, responses, validation, JWT, caches
└── modules/
    ├── auth/               OTP + Google sign-in, sessions (JWT + Redis api token)
    ├── user/               Profiles
    ├── project/            Survey projects (client, location, surveyor, status)
    ├── plan/               Survey plans: data editing, generation, computation import/convert
    ├── traverse/           Back / forward / traverse computations, bearings, area
    └── leveling/           Differential leveling (rise-and-fall & height-of-instrument)
```

**Request flow**: route → validation (validatorjs) → controller (HTTP concerns) → service
(business logic) → repository (MongoDB). Errors are thrown as `ApiError` anywhere in the
chain and rendered by the global error handler.

**Response envelope** (all endpoints): `{ code, error, message?, data? }`.

**Authentication** uses two credentials together: a signed, AES-encrypted JWT
(`Authorization: Bearer <token>`) and a revocable Redis-backed token (`x-api-token`).
Logging out revokes the api token.

## Surveying computations

- **Back computation** — distances, whole-circle bearings, and (optionally) parcel area
  from known coordinates (shoelace method).
- **Forward computation** — station coordinates from bearing/distance legs, with linear
  misclosure detection and optional correction distributed by cumulative arithmetic sums.
- **Traverse computation** — carries bearings through observed angles from known control,
  distributes angular misclosure across legs when a check leg closes the traverse, then runs
  a forward computation for coordinates.
- **Differential leveling** — rise-and-fall or height-of-instrument reduction, with optional
  misclosure correction distributed per instrument setup.

`tests/computations.test.ts` locks these engines against golden fixtures — run `npm test`
after touching any of them.

## API overview

All routes are mounted under `/api/v1`. 🔒 = requires authentication.

| Area | Route | Description |
|------|-------|-------------|
| Auth | `POST /auth/login/otp` | Email an OTP (creates the account on first login) |
| | `POST /auth/login` | Exchange email + OTP for a session |
| | `POST /auth/login/google` | Sign in with a Google ID token |
| | `GET /auth/logout` 🔒 | Revoke the current api token |
| User | `POST /user/profile/set` 🔒 · `GET /user/profile/fetch` 🔒 | Profile management |
| Project | `POST /project/create` 🔒 · `GET /project/list` 🔒 · `GET /project/fetch/:id` 🔒 · `PUT /project/edit/:id` 🔒 · `DELETE /project/delete/:id` 🔒 | Project CRUD |
| Plan | `POST /plan/create` 🔒 · `GET /plan/list/:project_id` 🔒 · `GET /plan/fetch/:plan_id` 🔒 · `PUT /plan/edit/:plan_id` 🔒 · `DELETE /plan/delete/:plan_id` 🔒 | Plan CRUD |
| | `PUT /plan/{coordinates,elevations,parcels}/edit/:plan_id` 🔒 | Survey data |
| | `PUT /plan/topo/{boundary,setting}/edit/:plan_id` 🔒 | Topographic data |
| | `PUT /plan/layout/boundary/edit/:plan_id` 🔒 | Layout perimeter (auto-closed ring) |
| | `PUT /plan/layout/params/edit/:plan_id` 🔒 | Layout design parameters (plot module, roads, blocks, reserves) |
| | `PUT /plan/layout/data/edit/:plan_id` 🔒 | Designed layout data: coordinate register, plots, roads |
| | `PUT /plan/route/longitudinal/params/edit/:plan_id` 🔒 | Route profile parameters |
| | `PUT /plan/route/params/edit/:plan_id` 🔒 | Route plan-view parameters (right-of-way, toggles) |
| | `PUT /plan/{traverse,forward,differential-leveling}-data/edit/:plan_id` 🔒 | Field computations |
| | `GET /plan/generate/:plan_id` 🔒 | Generate the drawing (Python service) |
| | `PUT /plan/computation/convert/:plan_id` 🔒 | Convert a computation into a plan |
| | `PUT /plan/import/:plan_id` 🔒 | Import a computation into a plan |
| Compute | `POST /traverse/back-computation` · `POST /traverse/forward-computation` · `POST /traverse/traverse-computation` · `POST /traverse/area-computation` | Stateless traverse computations |
| | `POST /leveling/differential` | Stateless leveling reduction |

## Getting started

Requirements: Node.js 22+, MongoDB, Redis.

```bash
npm install
cp .env.example .env    # fill in your values

npm run dev             # ts-node + nodemon
npm test                # computation regression tests
npm run build && npm start
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default 3000) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URI` | Redis connection string |
| `JWT_SECRET` | EC (ES256) private key in PEM format, `\n`-escaped |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM payload encryption |
| `GOOGLE_CLIENT_ID` | OAuth client id for Google sign-in |
| `PYTHON_SERVER` | Base URL of the plan-drawing Python service |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins, or `*` |
| `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` / `AWS_REGION` / `AWS_SES_SENDER` | SES credentials for OTP emails |

## Deployment

Pushes to `main` trigger `.github/workflows/prod.yml`: the Docker image is built and pushed
to Docker Hub, then deployed to the production Ubuntu server over SSH with Docker Compose.
Required secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SERVER_HOST`, `SERVER_USERNAME`,
`SERVER_SSH_KEY`, `SERVER_PORT`.

## License

MIT — see [LICENSE](LICENSE).
