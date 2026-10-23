# Lovable Prompt: UI-Only Changes

Use the instructions below when asking Lovable to refine the visual design of this application. The goal is to let Lovable work on presentation while keeping database, backend, authentication, and data-fetching work separate.

---

## Copy and paste into Lovable

You are working on the Klasora multi-tenant school portal. Your assignment is **UI and visual presentation only**. Database, backend, authentication, authorization, and data-integration work are handled separately by another developer.

### Objective

Improve the visual quality and usability of the specific page(s) I name in my request. Keep the established Klasora design language recognizable. Make the interface clearer, more polished, responsive, accessible, and consistent without changing what the application does.

Before making changes:

1. Inspect the requested page and the existing shared UI components and design tokens it uses.
2. Identify the exact files you expect to modify.
3. Preserve the current visual identity, tenant branding, and established navigation unless my request explicitly asks for a visual adjustment to them.
4. If a requested visual change appears to require changing database, API, authentication, authorization, or other application behavior, **do not implement that part**. Explain the conflict and ask for clarification.

### Strict scope: presentation only

You may make narrowly scoped changes to:

- Layout, spacing, alignment, sizing, and responsive behavior.
- Typography, color usage, borders, shadows, and visual hierarchy, using existing project conventions and design tokens where possible.
- Visual styling and composition of cards, tables, tabs, dialogs, labels, buttons, and navigation elements.
- Presentational JSX markup when necessary, provided the page's behavior and data flow remain unchanged.
- Accessible visual details such as focus indicators, contrast, heading hierarchy, and descriptive visible labels, as long as they do not change API or form behavior.
- Loading, empty, success, and error-state presentation, **without changing when or how those states are triggered or what data they contain**.

Keep the change limited to the pages and components that are necessary for my specific visual request. Do not perform a broad redesign or unrelated cleanup.

### Protected behavior: do not modify

Do not create, change, remove, rename, or reconfigure any of the following:

- Database schemas, tables, columns, constraints, policies, extensions, or database data.
- Migration files or migration execution behavior. In this project, schema changes must be managed only through `database/migrations/*.sql`, applied in filename order by `scripts/migrate.mjs`; however, **this UI-only task must not add or edit migrations**.
- SQL queries, database transactions, tenant database context, database connection code, or database helper functions.
- Server API route behavior, endpoint URLs, HTTP methods, authorization rules, role checks, request payloads, response shapes, validation, or error semantics.
- Authentication, session handling, access tokens, cookies, tenant resolution, or tenant isolation.
- Data fetching, polling, caching, refetching, refresh behavior, or the point at which existing requests run.
- State-management behavior, component effects, callbacks, event handlers, form submission logic, or persistence behavior.
- Form fields' names, values, validation rules, defaults, controlled/uncontrolled behavior, submit/cancel behavior, or button actions.
- Route definitions, route paths, sidebar destinations, role-specific navigation visibility, or access restrictions.
- Existing business rules, calculations, sorting, filtering, pagination, status mapping, or data formatting that affects meaning.
- Environment variables, Vercel settings, deployment configuration, package dependencies, or build configuration.

In particular, do not replace live school data with mock, demo, sample, hardcoded, fixture, or local-only data. Do not add fake counts or fabricate records to make a screen look populated. Do not hide a database or API failure by rendering an empty state or success state.

### Required behavior to preserve

For every affected page:

- Continue to display data returned by the existing tenant-scoped database-backed API calls.
- Continue to fetch data when the page currently fetches it, and continue to refresh it after successful writes where it currently does so.
- Preserve the existing loading, populated, empty, error, and success states and their conditions.
- Preserve working create, edit, assign, link, save, and navigation actions exactly as they are now.
- Preserve school/tenant scoping and all role-based access behavior.
- Keep every existing field, table column, filter, tab, and control unless I specifically request a presentation-only change that does not remove functionality.
- Do not imply a feature is available when its backend workflow is not implemented. For example, do not add payment-recording or coupon-generation controls unless I separately request and authorize that functional work.

### Safe editing rules

- Prefer changing styles, layout classes, and presentational markup over changing component logic.
- Do not rename props, state variables, route IDs, API helper functions, or data types for cosmetic reasons.
- Do not extract or rewrite data-fetching or form logic while changing the page design.
- Do not add dependencies or new UI frameworks.
- Do not reformat unrelated files or make repository-wide formatting changes.
- If a page combines UI and logic in one file, edit only its presentation. Treat every request, response, state transition, callback, effect, and handler as protected.
- If preserving the behavior cannot be guaranteed, stop and report what needs a separate functional change instead of guessing.

### Verification required before handing back

After making the visual changes:

1. Run the existing production build, if available.
2. Run the narrowest relevant lint/type checks without modifying unrelated files.
3. Inspect the final diff and confirm that it contains only presentation-related changes in the requested scope.
4. Explicitly confirm that no database, migration, API, auth, tenant-isolation, role-check, data-fetching, form-submission, or persistence logic was changed.
5. Report the files changed and summarize visual improvements.
6. Report validation results honestly, including any failures. Do not claim the work passed a check that was not run or that failed.

### Branch, commit, and deployment restrictions

- Work on a separate review branch; do not work directly on `main`.
- Do not commit, merge, push, or deploy unless I explicitly ask you to do so after reviewing the diff.
- Do not change Vercel project settings, environment variables, domains, production aliases, or deployment configuration.
- Do not revert, overwrite, or rewrite existing commits or work by another contributor.

### Completion report

When finished, provide:

- A short summary of the visual changes.
- The exact list of changed files.
- Confirmation that application and database behavior were preserved.
- Build, lint, and type-check results, clearly distinguishing checks that passed, failed, or were not run.
- Any visual request you could not safely complete without changing application behavior.
- Confirmation that you have not committed, merged, pushed, or deployed.

---

## Request-specific instruction

After pasting the prompt above, add a final request describing the exact page(s) and visual improvements you want. Keep the request focused, for example:

> Refine the visual presentation of the tenant-admin Classes and Grades pages. Improve spacing, responsive table layout, and visual hierarchy while keeping the existing Klasora colors and components. Do not change behavior.
