# Navbar Highlight Initialization Fix

Resolves an issue where the navigation bar fails to highlight the active **Home** link upon first launching the portfolio at the root URL (`/`).

## User Review & Critical Decisions

> [!NOTE]
> The root cause is unambiguous and self-contained within the navigation chrome initialization flow, so no additional configuration or design changes are required.

- **Root Path Normalization**: Treat directory-root URLs ending with `/` (such as `/` on initial app launch) as equivalent to `/index.html` when matching navigation links and registering in-page section observers.
- **Sub-route Highlight Continuity**: Keep **Projects** highlighted when viewing individual project detail or project documentation pages so navigation context is never lost.

## 1. Overview & Core Concept

- **What It Does**: Ensures the navigation bar immediately highlights the active page link (**Home** on initial launch at `/`) and tracks in-page section scrolling seamlessly from the first load.
- **Target Audience / Persona**: Portfolio visitors arriving at the root domain URL (`https://.../`) before clicking any explicit `.html` navigation links.
- **Key Value**: Eliminates the uninitialized navigation state on first visit, providing immediate visual orientation (`active` pill styling and `aria-current="page"` accessibility state).

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **First Launch (`/` or `/index.html`)**: As soon as the shared navbar component mounts, the **Home** pill immediately receives the `.active` state and `aria-current="page"`.
  2. **Hash & Section Navigation**: Loading with a hash (e.g., `/#hero`) or scrolling through observed sections updates the active highlight smoothly.
  3. **Page-to-Page Navigation**: Navigating to **Projects**, **About**, or **Contact** highlights the corresponding link immediately on load.
- **Visual Identity & Theme**:
  - Preserves the existing glassmorphic `.site-nav a.active` styling (`color: var(--primary)`, `background: var(--glass)`, `backdrop-filter: blur(8px)`, `transform: scale(1.08)`, and `box-shadow: inset 0 0 0 1px var(--glass-line)`).
- **Interactive Feedback & Motion**:
  - Retains the existing 0.2s transition on active pill state changes and the 800ms click-lock timer during smooth scrolling.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Canonical Path Normalization (`/` ↔ `/index.html`)**
  - *Chosen Approach*: Normalize any pathname ending in `/` by appending `index.html` before comparing `window.location.pathname` against resolved navbar link pathnames.
  - *Why*: When the app first launches, the browser's pathname is `/`, whereas the navbar's **Home** link (`index.html#hero`) resolves to `/index.html`. Strict string equality (`'/' === '/index.html'`) fails for both initial link highlighting and `IntersectionObserver` section binding. Canonicalizing `/` to `/index.html` fixes both mechanisms at once while remaining compatible with subpath deployments.
  - *Alternatives Considered*: Changing the navbar link href from `index.html#hero` to `/#hero` was passed over because the site chrome loader is designed to work at any directory depth without assuming a domain root.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Initial App Launch (GET /)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Site Chrome Loader (DOMContentLoaded)          │
│     Fetches & mounts background, navbar, and footer partials    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Pathname Normalization Helper                  │
│          Converts trailing "/" ──► "/index.html" so             │
│       window.location.pathname matches resolved link URLs       │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│   Initial Active Link Match   │ │  In-Page Section Observer     │
│ Sets .active & aria-current   │ │ Binds IntersectionObserver to │
│ on matching page/hash nav item│ │ #hero and other page sections │
└───────────────────────────────┘ └───────────────────────────────┘
```

- **Data Model & State**:
  - **Normalized Pathname**: Derived string representation of a URL pathname where trailing slashes resolve to `/index.html`.
  - **Active Link State**: Controlled via `.active` CSS class and `aria-current="page"` attribute on `.site-nav a` elements, paired with `pendingActiveSectionId` click-lock state.
- **Interactive Component & State Mapping**:
  - **Initial Load (`initializeNavbarSectionHighlight`)**: Normalizes `window.location.pathname` and each navbar link's `URL.pathname` before computing `pageHashLinks` and `pathLink`. If no hash is present on `/`, `pathLink` matches the **Home** link (`index.html#hero`) and activates it immediately.
  - **Scroll Observation (`IntersectionObserver`)**: Because `pageHashLinks` now includes `index.html#hero` even when the browser URL is `/`, the `#hero` section is properly observed on initial launch.
