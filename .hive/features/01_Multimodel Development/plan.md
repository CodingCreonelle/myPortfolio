# Testing Plan

## Overview
Validate the static portfolio without changing implementation. The test pass will check that referenced local assets resolve, HTML pages contain no broken internal links, JavaScript files parse/load in a browser, and the primary pages render without console errors. Because this repository has no package manifest or test runner, verification will use lightweight repository checks and browser smoke tests.

## Scope
- Pages: `index.html`, `about.html`, `contact.html`, `projects.html`, project/demo/documentation entry pages discovered from the workspace.
- Static dependencies: local CSS, JavaScript, JSON, image, font, video, and component references.
- Runtime behavior: navbar/data loading and page load errors in a browser.

## Acceptance Criteria
- No missing local files are reported for references used by the tested pages.
- No broken internal HTML links are reported.
- All JavaScript files pass syntax checking where the available runtime supports it.
- Primary pages load with no uncaught browser console errors.
- No source files are modified as part of this testing task.

## Constraints
- Do not install dependencies or introduce a test framework for this static-site smoke test.
- Use an ephemeral local server only if required for browser behavior; do not leave a server running after verification.

## Tasks
### 1. Run repository smoke checks
Inspect local references and validate JavaScript syntax using available built-in tooling. Record any failures with file paths and the referenced target.

### 2. Run browser smoke tests
Serve the portfolio locally if needed and load the primary pages. Check page status, console errors, and key page landmarks such as the navbar and main content.

### 3. Report results
Summarize passed checks, failures, and any residual limitations. Do not modify implementation files unless a separate approved plan is created.
