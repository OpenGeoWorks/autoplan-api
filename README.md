# AutoPlan-API

Backend API for the AutoPlan Web Application for the Geospatial Industry.

This repository contains a TypeScript + Express API that provides authentication, user/profile management, project and plan management, traverse and leveling computations, and integrations with MongoDB, Redis, AWS SES/Resend for email, and JWT-based auth.

## Table of contents

- About
- Quick start
- Project structure
- Key concepts & architecture
- Environment variables
- Scripts
- API reference (summary)
- Development notes
- Contributing
- License

## About

The API is written in TypeScript and organized with a clean separation between adapters, domain (entities, errors, interfaces), use-cases, and infrastructure. The main entrypoint is `src/main/server.ts`, which wires the dependency container, connects to MongoDB and Redis, and starts the Express server.

Its primary features include:

- Authentication (OTP login, Google OAuth, JWT)
- User profile management
- Project CRUD
- Plan creation and editing (coordinates, elevations, parcels, topo settings)
- Traverse and leveling computations (forward/back computation, traverse computation, differential leveling)

## Quick start

Prerequisites:

- Node.js (v18+ recommended)
- npm
- A running MongoDB instance (or connection URI)
- A Redis instance (for caching)

1. Install dependencies

```bash
npm install
```

2. Create an `.env` file at the project root. See the Environment variables section below for required keys.

3. Build the project

```bash
npm run build
```

4. Start the server (production build)

```bash
npm start
```

For local development you can build and run the output with nodemon (the repo uses a dist-first dev workflow):

```bash
npm run build:watch   # compile in watch mode
npm run dev           # run the compiled server with nodemon
```

The API will be available at http://localhost:3000 (or the port defined in your `.env`). Health check: `GET /health`.

## Project structure

Top-level folders and a short description of their responsibilities:

- `src/main` — application wiring, server/bootstrap, routes, adapters and DI container.
- `src/adapters` — controllers, cache adapters, and other framework adapters.
- `src/domain` — core entities, types, errors and domain interfaces.
- `src/use-cases` — application business logic (authentication, plan/project operations, computations).
- `src/infrastructure` — concrete implementations for DB, redis, cryptography, email (SES/Resend), validator utilities, and configuration.
- `src/repositories` — data access abstractions and implementations.
- `src/utils` — utility functions such as distance calculations.

Important entry files:

- `src/main/server.ts` — program entrypoint.
- `src/main/app.ts` — express app setup and route mounting.
- `src/infrastructure/config/env.ts` — environment parsing and exported constants.

## Key concepts & architecture

The app uses dependency injection (a container defined in `src/main/config/container.ts`) to wire controllers, repositories, and adapters. The codebase follows a hexagonal/clean architecture style:

- Controllers (adapters) translate HTTP requests into use-case calls.
- Use-cases contain application-specific business logic.
- Repositories provide persistence abstractions used by use-cases.
- Infrastructure provides concrete implementations (MongoDB, Redis, email, JWT, bcrypt).

Express routes are defined under `src/main/routes` and are mounted under the base path `/api/v1` in `App.setupRoutes()`.

## Environment variables

Create an `.env` file with the following keys (the app reads them from `src/infrastructure/config/env.ts`):

- PORT — server port (default 3000)
- JWT_SECRET — RSA/PEM string or symmetric secret used for JWT signing
- ENCRYPTION_KEY — key for additional symmetric encryption used in the app
- MONGO_URI — mongo connection string
- REDIS_URI — redis connection string
- RESEND_API_KEY — API key for resend.email (optional)
- AWS_SECRET_KEY — AWS secret access key (optional, used for SES)
- AWS_ACCESS_KEY — AWS access key id (optional)
- AWS_BUCKET — S3 bucket name (optional)
- AWS_REGION — AWS region (optional)
- AWS_SES_SENDER — Verified sender email for SES (optional)

Note: `JWT_SECRET` is parsed using `parsePemKey` helper (turns literal `\n` into newlines). If you use multi-line PEMs in an env file, escape newlines as `\n`.

## Scripts

- `npm run build` — cleans `dist`, copies html assets and runs `tsc` with `tsconfig-build.json` (produces `dist`).
- `npm run build:watch` — builds in watch mode.
- `npm run dev` — runs `nodemon` on the compiled `dist/main/server.js` (the repo uses a dist-first dev workflow).
- `npm start` — runs the compiled server from `dist`.

## API reference (summary)

All API endpoints are mounted under `/api/v1`.

Auth

- POST /api/v1/auth/login/otp — Send login OTP
- POST /api/v1/auth/login — Login with credentials or OTP
- POST /api/v1/auth/login/google — Login with Google
- GET /api/v1/auth/logout — Logout (protected)

User (protected)

- POST /api/v1/user/profile/set — Set or update profile
- GET /api/v1/user/profile/fetch — Fetch user profile

Project (protected)

- POST /api/v1/project/create — Create project
- GET /api/v1/project/list — List projects
- GET /api/v1/project/fetch/:project_id — Fetch project by id
- PUT /api/v1/project/edit/:project_id — Edit project
- DELETE /api/v1/project/delete/:project_id — Delete project

Plan (protected)

- POST /api/v1/plan/create — Create plan
- GET /api/v1/plan/list/:project_id — List plans for project
- GET /api/v1/plan/fetch/:plan_id — Fetch plan
- PUT /api/v1/plan/edit/:plan_id — Edit plan
- PUT /api/v1/plan/coordinates/edit/:plan_id — Edit coordinates
- PUT /api/v1/plan/elevations/edit/:plan_id — Edit elevations
- PUT /api/v1/plan/parcels/edit/:plan_id — Edit parcels
- PUT /api/v1/plan/topo/boundary/edit/:plan_id — Edit topo boundary
- PUT /api/v1/plan/topo/setting/edit/:plan_id — Edit topo setting
- PUT /api/v1/plan/route/longitudinal/params/edit/:plan_id — Edit longitudinal profile parameters
- PUT /api/v1/plan/traverse-data/edit/:plan_id — Edit traverse computation data
- PUT /api/v1/plan/forward-data/edit/:plan_id — Edit forward computation data
- PUT /api/v1/plan/differential-leveling-data/edit/:plan_id — Edit differential leveling data
- GET /api/v1/plan/generate/:plan_id — Generate plan (export/compute)

Traverse & Leveling (some endpoints may be unprotected by default in routes)

- POST /api/v1/traverse/back-computation
- POST /api/v1/traverse/forward-computation
- POST /api/v1/traverse/traverse-computation
- POST /api/v1/leveling/differential

For request/response shapes, consult the controllers in `src/adapters/controllers` and the use-cases under `src/use-cases`.

## Development notes

- The project uses module-alias mappings for runtime; in production those point to `dist/*` (configured in `package.json` under `_moduleAliases`).
- The TypeScript build target is configured in `tsconfig-build.json` — the compiled code is placed into `dist` and the app expects `dist/main/server.js` as the entry.
- The DI container is defined at `src/main/config/container.ts` — register additional implementations there if you add services.

## Contributing

If you want to contribute, please:

1. Fork the repository
2. Create a feature branch
3. Make changes and add unit tests where appropriate
4. Open a PR describing your changes

Automated tests are currently absent from this repository. It is strongly recommended to implement unit and integration tests for critical features such as authentication, computations, and data operations. Contributors are encouraged to include relevant tests with their changes to improve reliability and maintainability.

## License

This repository is licensed under ISC (see `package.json`).

---
