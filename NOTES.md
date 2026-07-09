# Teaching Notes

## User Preferences

- No user-owned projects — all practice should be based on open-source study projects or scratch exercises
- Target domains: Agent/AI development, backend service development
- Wants a structured, sequential curriculum with clear deliverables per lesson
- Prefers hands-on coding over theory

## Selected Reference Projects

These open-source projects are the "textbooks" for the curriculum:

| Project | Role in Curriculum |
|---|---|
| **chi** | Study HTTP routing and middleware patterns (Phase 2) |
| **pgx + sqlc** | Study database access patterns (Phase 3) |
| **PocketBase** | Study project layout, concurrency, SSE (Phase 4-6) |
| **langchaingo** | Study agent loops, tool use, LLM abstraction (Phase 7) |
| **Ollama** | Study API design, CLI patterns (supplementary) |
| **gh (GitHub CLI)** | Study CLI structure, testing (supplementary) |

## Lesson Cadence

Each lesson follows this structure (encoded in the HTML):
1. **Why this matters** — tied to Agent/backend goals
2. **Key concepts** — minimal knowledge, maximum clarity
3. **Code study** — read a specific file/pattern from the reference project
4. **Hands-on practice** — write code, get immediate feedback (quiz or exercise)
5. **Reference links** — primary sources, glossary entries
6. **Follow-up prompt** — remind user to ask questions
