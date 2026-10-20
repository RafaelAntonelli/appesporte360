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
- Medical leave lives in licencas_medicas (one active per student) with shared rules in src/lib/licenca.ts; enrollments stay active during leave so the seat stays reserved.
- Backup runs (manual and automatic) are recorded in backup_historico with per-file failures so failed files can be resent alone; Drive uploads retry transient errors (429/5xx/network) up to 3 times before failing.
- Teacher permissions are enforced in RLS via public.pode(uid, chave) reading permissoes_professor (admins always pass); UI gating in src/lib/permissoes.ts mirrors it — why: hiding buttons alone is not security.
- Records keep the registrar's name in *_por_nome columns filled by trigger, and user FKs use ON DELETE SET NULL — why: removed accounts must not erase who registered.
- Use DOCUMENTOS_PLANILHA as the shared document catalog in enrollment forms and profiles, and keep backup document destinations aligned — why: every attachment must remain visible and exportable.
- Keep AI gateway code server-only behind authenticated permission checks, durable denial state and explicit administrator resumption — why: UI controls cannot protect credentials or authorization.
- Use the shared AI report calculator with keyset pagination and same-active-enrollment dimension matching; deduplicate students per group — why: multiple enrollments must not distort totals or mix unrelated class attributes.
- Keep AI proposals separate from persisted records and invalidate upload proposals when their source changes — why: every assisted write requires human review and existing validation.
- Student access has no auth accounts: a device token (stored only as a SHA-256 hash in aluno_aparelhos, approved in person by an admin) is checked in public server functions that read and write only the caller's own student record through the admin client — why: students must never reach other students' data or staff tables.
- Student push notifications are sent from server code through the linked Firebase Cloud Messaging connection (connector gateway, FIREBASE_MESSAGING_* secrets), and the root service worker (public/sw.js) displays them — why: one worker scope serves both the offline cache and push.
