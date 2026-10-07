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

- Treat each active student enrollment as an independent modality/class choice, allowing up to three distinct modalities; attendance is unique per student, class, and date so multi-enrolled students remain independent.
- Generate student enrollment codes in the database as unique uppercase alphanumeric identifiers with exactly 7 characters so every creation path stays consistent.
- Use the shared certificate notification predicates in student filters and certificate reports so notification counts and lists follow the same eligibility rule.
- Keep school suggestions grouped by education network in a browser-safe shared module and use a dedicated searchable selector with manual addition in the enrollment form, so existing and unlisted school names remain valid without changing the shared catalog.
- Use one shared browser-safe WhatsApp link helper and contact button for student forms, profiles, and notification lists; click-to-chat delegates app/web handoff without claiming number availability.
- Normalize emitted server createRequire helpers to a literal file URL in the Nitro output hook; the hosted Worker may not provide import.meta.url during module initialization.
