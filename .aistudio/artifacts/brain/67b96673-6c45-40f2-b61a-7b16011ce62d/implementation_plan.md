# GitHub Repository & CI Branch Configuration (`AI_Studio`)

Configures the project's GitHub Actions CI/CD workflow and local Git branch metadata to support the `AI_Studio` branch alongside `main`, while keeping portfolio showcase links pointed at the repository root.

## User Review & Critical Decisions

> [!IMPORTANT]
> **AI Studio GitHub Sync UI**: In addition to the repository configuration changes below, when committing or pushing from the AI Studio top toolbar (**GitHub** icon), select or enter `AI_Studio` as the target branch in the AI Studio GitHub dialog so cloud sync pushes directly to `AI_Studio`.

- **Confirmed Decision 1 — Multi-Branch CI Support**: Update the GitHub Actions CI workflow to trigger validation, Docker smoke tests, and image publishing on both `AI_Studio` and `main` (as well as `master`).
- **Confirmed Decision 2 — Repository Root Links**: Keep public portfolio links in project data pointing to the default repository root (`https://github.com/CodingCreonelle/myPortfolio`).

## 1. Overview & Core Concept

- **What It Does**: Aligns the repository's continuous integration pipeline and local Git branch tracking with the `AI_Studio` branch so changes pushed from AI Studio are automatically validated, smoke-tested, and published.
- **Target Audience / Persona**: The repository maintainer syncing work between Google AI Studio Build (`AI_Studio` branch) and GitHub.
- **Key Value**: Ensures pushes and pull requests targeting `AI_Studio` run the full static asset validation, Dockerfile linting, container smoke tests, and GHCR image publishing pipeline without breaking `main`.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Pushing to `AI_Studio`**: When changes are pushed to the `AI_Studio` branch on GitHub, GitHub Actions automatically runs `Validate Static Assets`, `Lint Dockerfile`, `Docker Build & Smoke Test`, and `Publish to GHCR`.
  2. **Portfolio Visitor Experience**: Visitors browsing the portfolio projects page continue to land on the clean root repository URL (`https://github.com/CodingCreonelle/myPortfolio`) with no visual regressions.
- **Visual Identity & Theme**:
  - No visual or layout changes to the frontend portfolio; preserves the existing dark/light theme tokens and editorial layout.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Branch CI Triggers (`AI_Studio` + `main`)**
  - *Chosen Approach*: Add `AI_Studio` to `on.push.branches`, `on.pull_request.branches`, and the `publish-image` conditional check in the CI workflow.
  - *Why*: Allows active development on `AI_Studio` to receive full automated testing and container registry updates while keeping `main` protected and operational when changes are merged.
  - *Alternatives Considered*: Replacing `main` exclusively with `AI_Studio` was passed over so merges back to `main` still trigger production verification.
- **Decision 2: Local Git Branch & Remote Initialization**
  - *Chosen Approach*: Initialize the workspace Git repository on branch `AI_Studio` with `origin` linked to `https://github.com/CodingCreonelle/myPortfolio.git`.
  - *Why*: Ensures any local Git inspection or CLI tooling within the workspace reflects `AI_Studio` as the active branch rather than defaulting to `main`.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────┐
│             AI Studio Workspace (Branch: AI_Studio)             │
│    Remote Origin ──► github.com/CodingCreonelle/myPortfolio     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                     Push / PR (AI_Studio or main)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI Pipeline                   │
│         Triggers: branches [AI_Studio, main, master]            │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│   Validate Assets & Hadolint  │ │   Docker Build & Smoke Test   │
│  Checks JSON data & Dockerfile│ │  Verifies routes & cache rules│
└───────────────┬───────────────┘ └─────────────┬─────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Publish Container Image (GHCR)                  │
│   Runs on push to refs/heads/AI_Studio or refs/heads/main       │
└─────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **CI Branch Triggers**: `[AI_Studio, main, master]` for both `push` and `pull_request` events.
  - **GHCR Publish Gate**: `github.event_name == 'push' && (github.ref == 'refs/heads/AI_Studio' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')`.
- **Interactive Component & State Mapping**:
  - Public project links remain unchanged (`https://github.com/CodingCreonelle/myPortfolio`).
  - Local Git state tracks branch `AI_Studio` with remote `origin` pointed at `https://github.com/CodingCreonelle/myPortfolio.git`.
