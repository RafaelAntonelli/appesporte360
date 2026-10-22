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

- Each active enrollment is an independent modality/class (max three distinct); attendance is unique per student, class and date.
- Enrollment codes are generated in the database: unique, uppercase alphanumeric, exactly 7 chars — why: every creation path stays consistent.
- Use the shared certificate notification predicates in student filters and certificate reports so notification counts and lists follow the same eligibility rule.
- School suggestions are grouped by education network in a browser-safe module, picked via a searchable selector that allows manual entry — why: unlisted school names stay valid without editing the catalog.
- One shared browser-safe WhatsApp link helper and contact button everywhere; click-to-chat never claims the number has WhatsApp.
- Nitro output hook rewrites createRequire helpers to a literal file URL — why: the Worker may lack import.meta.url at init.
- Medical leave lives in licencas_medicas (one active per student) with shared rules in src/lib/licenca.ts; enrollments stay active during leave so the seat stays reserved.
- Backup runs are logged in backup_historico with per-file failures (resend alone); Drive uploads retry 429/5xx/network up to 3 times.
- Teacher permissions are enforced in RLS via public.pode(uid, chave) reading permissoes_professor (admins always pass); UI gating in src/lib/permissoes.ts mirrors it — why: hiding buttons alone is not security.
- Changing teacher permissions requires a recent admin password re-check: desbloquearPermissoesFn verifies the password server-side and writes a short-lived row in desbloqueios_permissoes that the permissoes_professor write policies require — why: an unattended admin session must not be enough to change permissions.
- Records keep the registrar's name in trigger-filled *_por_nome columns; user FKs are ON DELETE SET NULL — why: removed accounts keep authorship.
- Use DOCUMENTOS_PLANILHA as the shared document catalog in enrollment forms and profiles, and keep backup document destinations aligned — why: every attachment must remain visible and exportable.
- Student access has no auth accounts: a device token (stored only as a SHA-256 hash in aluno_aparelhos, approved in person by an admin) is checked in public server functions that read and write only the caller's own student record through the admin client — why: students must never reach other students' data or staff tables.
- Student push goes from server code via the linked Firebase Cloud Messaging connection; public/sw.js displays it — why: one worker scope serves offline cache and push.
- Class reminders run from a managed 5-minute HTTP schedule hitting /api/public/jobs/lembretes-aula; window rules live in src/lib/lembretes.ts (Brasília time) and lembretes_aula_enviados reserves each turma/date/lead time before sending — why: overlapping windows tolerate a missed tick without duplicate pushes.
- Drive files are named CODIGO_TIPO.ext (src/lib/arquivos-drive.ts), the backup sheet has no links, and restoration links files by code — why: codes are unique, names are not.
- Offline actions are queued in IndexedDB with a UUID, UTC timestamp and strictly increasing sequence, and sync sends them one by one and stops at the first failure — why: later actions must never reach the server before earlier ones.
- Links to student files are always signed and temporary: exports use the configured validity from src/lib/links-seguros.ts (capped server-side) and on-screen images use 1 hour — why: LGPD forbids permanent open links to personal documents.
- Every captured image goes through otimizarImagem (src/lib/imagem.ts) before upload or AI reading; PDFs pass unchanged — why: mobile networks.
- Dark mode is a `.dark` class on <html> applied by the inline SCRIPT_TEMA in __root before first paint and toggled via useTema (src/lib/tema.ts); screens use only theme tokens — why: no white flash and every screen themes without per-page colors.
- Student status uses situacaoDoAluno (src/lib/situacao.ts) with EtiquetaSituacao, and attendance UI uses BotoesChamada/ProgressoChamada/MarcarTodosPresentes (src/components/Chamada.tsx) with resumoChamada — why: Alunos, Turmas and Presença must show identical colors and bulk-marking rules.
- Pre-change screen copies live in .lovable/visual-anterior*/ — why: the user wants to be able to revert visual changes.
- Staff photos: private fotos-equipe bucket, own {uid}/ folder, path in profiles.foto_path; display name follows nome_usuario order — why: menu matches registrar names.
- Subdirectories may have their own AGENTS.md (e.g. src/lib/ai/); read it before changing files there.
