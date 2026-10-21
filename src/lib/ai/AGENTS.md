# AI modules

- Keep AI gateway code server-only behind authenticated permission checks, durable denial state and explicit administrator resumption — why: UI controls cannot protect credentials or authorization.
- Use the shared AI report calculator with keyset pagination and same-active-enrollment dimension matching; deduplicate students per group — why: multiple enrollments must not distort totals or mix unrelated class attributes.
- Keep AI proposals separate from persisted records and invalidate upload proposals when their source changes — why: every assisted write requires human review and existing validation.
