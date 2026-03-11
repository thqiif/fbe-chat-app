# DevOps Setup

## Structure

```text
/server  Node.js backend
/client  React + Vite frontend
/proto   Shared FBE proto files and generated JavaScript
```

`/proto/js` is the shared location for generated FBE JavaScript artifacts. Both Docker images copy this directory at build time, and the development compose stack mounts `/proto` directly so regenerated files are visible immediately.

## Docker

- `server/Dockerfile`
  - `development` stage runs the backend with `nodemon`
  - `production` stage runs the backend with `node`
- `client/Dockerfile`
  - `development` stage runs Vite on port `5173`
  - `production` stage builds the React app and serves it with `nginx`
- `docker-compose.yml`
  - `server` and `client` are the development services
  - `server-prod` and `client-prod` are enabled with the `prod` profile

## npm scripts

Root `package.json`:

- `npm run dev` starts the development compose stack
- `npm run prod` starts the production compose profile in detached mode
- `npm run build` runs backend and frontend build scripts
- `npm run down` stops the compose stack

Backend `server/package.json`:

- `npm run dev` starts the API with `nodemon`
- `npm run start` starts the API in production mode
- `npm run build` validates that the shared FBE JavaScript directory exists

Frontend `client/package.json`:

- `npm run dev` starts Vite
- `npm run build` creates the production bundle
- `npm run start` previews the production bundle locally

## FBE JavaScript inclusion

- Put generated FBE JavaScript under `/proto/js`
- The backend can access it directly from `../proto/js`
- The frontend can import it with the `@proto` alias configured in `client/vite.config.js`
- Development containers bind-mount `/proto`, so FBE regeneration does not require image rebuilds
- Production images copy `/proto` into the image during the Docker build

## Usage

Development:

```bash
npm run dev
```

Production:

```bash
npm run prod
```

Local app ports:

- Frontend dev: `http://localhost:5173`
- Frontend prod: `http://localhost:8080`
- Backend: `http://localhost:3001`
