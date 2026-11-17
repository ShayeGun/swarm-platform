# CI/CD Pipelines

This directory contains the GitLab CI/CD pipeline definitions for the portfolio projects. There are three pipelines, one per project:

| File | Project | Purpose |
|---|---|---|
| `package-gitlab-ci.yml` | npm package (`@cluster`) | Test and publish a Node package to the private npm registry |
| `app-gitlab-ci.yml` | Radius (web app) | Test, build, and deploy a single web image |
| `app2-gitlab-ci.yml` | SKM (web + task app) | Build and deploy a web image **and** a task image |

## Overview
![Overview](./assets/CI_CD%20Pipeline%20Patterns%20Infographic.png)

## Common practices across all pipelines

### Private registries
All registries used by the pipelines are private and are never hard-coded. They are injected through CI variables and authenticated per job:

- **npm** — `${NPM_REGISTRY}` (set via `npm config set registry`); the package pipeline also writes a project-scoped `.npmrc` pointing at `${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/` authenticated with `${CI_JOB_TOKEN}`.
- **Docker** — `${CI_REGISTRY}` (login with `${CI_REGISTRY_USER}` / `${CI_REGISTRY_PASSWORD}`).
- **Alpine / Debian (apt/apk)** — `${ALPINE_REGISTRY}`, `${ALPINE_PUB}`, `${DEBIAN_REGISTRY}`, exposed to the build as build args and a `temp` build context.

### Branch-driven deployment environments
A commit's branch determines the deployment target. Mapping used by the app pipelines:

| Branch | `DEPLOYMENT` | Target server |
|---|---|---|
| `production` | `production` | `$CI_PROD_SERVER_IP` |
| `master` | `stage` | `$CI_STG_SERVER_IP` |
| `develop` | `develop` | `$CI_DEV_SERVER_IP` |
| anything else | `local` | (no deploy) |

The image name is namespaced per environment, e.g. `${CI_REGISTRY}/cloud/radius/radius-${DEPLOYMENT}` and `${CI_REGISTRY}/cloud/server/skm-${DEPLOYMENT}`.

### Automated vs. manual runs
- **Automated:** merge request events, and merges to `develop`, `master`, and `production`.
- **Manual:** pipelines for any other branch (jobs use `when: manual`).
- **De-duplication:** if a branch has an open merge request, the branch pipeline is skipped (`when: never`) to avoid duplicate runs.

### Image tagging convention
Every build produces tags derived from the branch and commit:

- `web-latest` — newest image for the environment.
- `web-<jira-task>` — derived from the branch name; branch names are expected to contain a Jira key matching `nes-[0-9]{2,}` (lowercased).
- `web-<commit>` — first 7 characters of `${CI_COMMIT_SHA}`.

The SKM pipeline additionally builds a second image (`Dockerfile.task`) with the matching `task-latest`, `task-<jira-task>`, and `task-<commit>` tags.

### Build reproducibility
- `set -e` is used in scripts.
- `DOCKER_BUILDKIT=1` is enabled.
- `VERSION` is derived from the commit SHA so images are traceable.
- `after_script` blocks print a clear success/failure status per job.

### Deployment mechanism
Deploys run over SSH using an RSA key (`$CI_ID_RSA`) with strict host-key checking disabled:

1. Log in to the registry on the target server.
2. Pull the `*-latest` image(s).
3. Source the host env file (`$CI_HOST_ENV_FILE`).
4. Remove the existing service (`$CI_SERVICE_NAME`).
5. Redeploy the stack with `docker stack deploy --resolve-image never`.

> **Why the service is removed first:** the stack is deployed with `--resolve-image never` (i.e. image pull policy `never`). With that policy Docker will not pull/refresh the image for an already-running service, so the old container would keep running. Removing `$CI_SERVICE_NAME` first forces the service to be recreated from the freshly pulled image.

## Pipeline-specific notes

### `package-gitlab-ci.yml` (npm package)
- Stages: `test` → `publish`.
- Image: `node:20`.
- `test`: `npm ci` + `npm test` against `${NPM_REGISTRY}`.
- `publish`: writes a project-scoped `.npmrc`, runs `npm ci`, bumps the patch version (`npm version patch --no-git-tag-version`), and publishes.
- Publish only runs on the `main` branch (no Docker/deploy stage).

### `app-gitlab-ci.yml` (Radius)
- Stages: `test` → `build` → `deploy`.
- Test image: `node:20-bookworm`; `npm ci --prefer-offline` + `npm run test`.
- Build image: `docker:latest`; single `Dockerfile`; tags `web-*`.
- Also copies the Alpine public key into the registry directory for the build context.
- Deploy pulls the single `web-latest` image and redeploys one service.

### `app2-gitlab-ci.yml` (SKM)
- Stages: `build` → `deploy` (no test stage).
- Build image: `docker:latest`; builds two images in one job:
  - `Dockerfile.web` → `web-*` tags
  - `Dockerfile.task` → `task-*` tags
- Uses both Debian and Alpine registries/build args.
- Deploy pulls both `web-latest` and `task-latest` before redeploying.

## Required CI variables (reference)

`NPM_REGISTRY`, `CI_REGISTRY`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`, `ALPINE_REGISTRY`, `ALPINE_PUB`, `ALPINE_PUB_HASH`, `DEBIAN_REGISTRY`, `NPM_TOKEN`, `CI_ID_RSA`, `CI_SERVER_USER`, `CI_PROD_SERVER_IP`, `CI_STG_SERVER_IP`, `CI_DEV_SERVER_IP`, `CI_HOST_ENV_FILE`, `CI_SERVICE_NAME`, `CI_COMPOSE_FILE`, `CI_STACK_NAME`.
