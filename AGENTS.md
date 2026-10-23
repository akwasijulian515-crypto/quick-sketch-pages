<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Database schema lives only in database/migrations/*.sql, applied in name order by scripts/migrate.mjs (tracked in schema_migrations) — one source of truth avoids schema drift.
- All workspace sidebars use the shared SchoolShell with a viewport-height frame and independently scrolling navigation, keeping branding and sign-out reachable.
