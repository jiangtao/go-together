# Go Resources

## Knowledge

- [Go Tour](https://go.dev/tour/) — Official interactive introduction. Use for: first contact with syntax, never for deep learning.
- [Go Modules Reference](https://go.dev/ref/mod) — Official module system reference. Use for: `go.mod`, module paths, `go get`, `go mod tidy`, version selection, module cache.
- [Effective Go](https://go.dev/doc/effective_go) — Canonical style guide from the Go team. Use for: every lesson that touches idioms, naming, or design.
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) — Go team-maintained review guidance. Use for: interfaces, naming, error strings, package comments, receiver names.
- [The Go Programming Language Specification](https://go.dev/ref/spec) — The actual language spec, surprisingly readable. Use for: resolving ambiguity about language behavior.
- [Go by Example](https://gobyexample.com/) — Runnable code snippets for ~80 Go features. Use for: quick syntax reference, pre-lesson warmup.
- [Go 1.13 Errors](https://go.dev/blog/go1.13-errors) — Official explanation of error wrapping, `errors.Is`, and `errors.As`. Use for: error handling lessons.
- [Go Blog: Context](https://go.dev/blog/context) — Official context design article. Use for: request-scoped cancellation, deadlines, and values.
- [Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines) — Official concurrency cancellation article. Use for: channel ownership, cancellation, goroutine cleanup.
- [The Go Memory Model](https://go.dev/ref/mem) — Official memory model. Use for: advanced concurrency, data race reasoning, happens-before.
- [Data Race Detector](https://go.dev/doc/articles/race_detector) — Official race detector guide. Use for: `go test -race` and interpreting reports.
- [100 Go Mistakes and How to Avoid Them](https://100go.co/) — Teiva Harsanyi. Catalog of common pitfalls with explanations. Use for: supplementing lessons with "common gotchas."
- [Let's Go](https://lets-go.alexedwards.net/) — Alex Edwards. Book-length tutorial building a production web app. Use for: HTTP service patterns, project structure, testing.
- [Let's Go Further](https://lets-go-further.alexedwards.net/) — Alex Edwards. Sequel: advanced patterns, API versioning, background tasks. Use for: Phase 4+ lessons.
- [testing package](https://pkg.go.dev/testing) — Official package docs. Use for: table-driven tests and subtests.
- [httptest package](https://pkg.go.dev/net/http/httptest) — Official HTTP testing package. Use for: handler tests.
- [TableDrivenTests](https://go.dev/wiki/TableDrivenTests) — Go wiki guidance. Use for: compact test case design.
- [net/http package](https://pkg.go.dev/net/http) — Official HTTP package docs. Use for: handlers, servers, shutdown.
- [encoding/json package](https://pkg.go.dev/encoding/json) — Official JSON package docs. Use for: struct tags, decoder behavior, unknown fields.
- [context package](https://pkg.go.dev/context) — Official context package docs. Use for: cancellation, deadline, values, `CancelFunc` rules.
- [sync package](https://pkg.go.dev/sync) — Official sync package docs. Use for: `Mutex`, `RWMutex`, `WaitGroup`, `Once`.
- [errgroup package](https://pkg.go.dev/golang.org/x/sync/errgroup) — Official `x/sync` docs. Use for: fan-out cancellation and concurrency limits.
- [log/slog package](https://pkg.go.dev/log/slog) — Official structured logging package docs. Use for: structured logs, handlers, `InfoContext`, `LogAttrs`.
- [Structured logging with slog](https://go.dev/blog/slog) — Official slog design article. Use for: why fields and handlers work the way they do.
- [signal.NotifyContext](https://pkg.go.dev/os/signal#NotifyContext) — Official signal cancellation docs. Use for: graceful shutdown root context.
- [gRPC Go Quickstart](https://grpc.io/docs/languages/go/quickstart/) — Official gRPC guide for Go. Use for: protoc setup, generated code flow, first unary RPC.
- [gRPC Go Basics](https://grpc.io/docs/languages/go/basics/) — Official tutorial covering service definition, server/client implementation, and streaming RPCs. Use for: RPC mental model.
- [gRPC Metadata](https://grpc.io/docs/guides/metadata/) — Official metadata guide. Use for: request metadata, auth headers, and response metadata.
- [gRPC Interceptors](https://grpc.io/docs/guides/interceptors/) — Official interceptor guide. Use for: logging/auth/retry cross-cutting RPC logic.
- [gRPC Status Codes](https://grpc.io/docs/guides/status-codes/) — Official status code guide. Use for: mapping domain errors to RPC codes.
- [gRPC Graceful Shutdown](https://grpc.io/docs/guides/server-graceful-stop/) — Official graceful stop guide. Use for: RPC server shutdown behavior.
- [Protocol Buffers Go Generated Code Guide](https://protobuf.dev/reference/go/go-generated/) — Official generated-code reference. Use for: understanding `.pb.go` APIs and message structs.
- [Protocol Buffers proto3 Guide](https://protobuf.dev/programming-guides/proto3/) — Official proto3 guide. Use for: field numbers, compatibility, message design.
- [Go Database SQL Tutorial](https://go.dev/doc/database/) — Official Go database docs. Use for: `database/sql`, prepared statements, transactions, and cancellations.
- [database/sql package](https://pkg.go.dev/database/sql) — Official package docs. Use for: `DB`, `Tx`, `Rows`, `Null*`, transaction behavior.
- [pgx README](https://github.com/jackc/pgx) — Project documentation. Use for: PostgreSQL driver/pool setup and supported versions.
- [pgxpool package](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool) — Package docs. Use for: connection pool lifecycle and config.
- [sqlc PostgreSQL tutorial](https://docs.sqlc.dev/en/latest/tutorials/getting-started-postgresql.html) — Project tutorial. Use for: SQL-first code generation.
- [sqlc configuration reference](https://docs.sqlc.dev/en/latest/reference/config.html) — Project config reference. Use for: `sqlc.yaml` and generated package layout.
- [golang-migrate/migrate](https://github.com/golang-migrate/migrate) — Project docs. Use for: versioned up/down migrations. Prefer v4 import/module paths.

## Official References by Phase

| Phase | 必读资料 | 用法 |
|---|---|---|
| Phase 01 Go Core | Go Modules Reference, Go Spec, Effective Go, Go 1.13 Errors, context package, Go Blog: Context | 建立 module/package、error、interface、context 心智 |
| Phase 02 HTTP + Testing | net/http, encoding/json, httptest, testing, TableDrivenTests | 写 HTTP handler、JSON DTO、middleware 和表驱动测试 |
| Phase 03 DB + sqlc + Tx | Accessing relational databases, database/sql, pgxpool, sqlc PostgreSQL tutorial, sqlc config, golang-migrate/migrate | 建立显式数据层、迁移、生成代码和事务边界 |
| Phase 04 gRPC Unary | gRPC Go Quickstart, gRPC Go Basics, proto3 Guide, Go Generated Code Guide, Status Codes | 先学 contract-first、生成代码、unary server/client 和错误码 |
| Phase 05 Concurrency/Ops | context, Pipelines and cancellation, sync, errgroup, Go Memory Model, Race Detector, log/slog, slog blog, Server.Shutdown, signal.NotifyContext, gRPC Graceful Shutdown | 学 streaming、取消、并发治理、race、日志和 shutdown |
| Phase 06 Agent/Capstone | langchaingo, Ollama API, chi, pgx, sqlc, grpc-go, connect-go | 用开源项目做四遍阅读和最小复刻 |

### Study Projects (Agent / AI)

- [langchaingo](https://github.com/tmc/langchaingo) — Go port of LangChain. Demonstrates LLM provider abstraction, chain composition, tool/function calling, memory management, agent loops. Study for: interfaces, concurrency in agent flows. Difficulty: Intermediate.
- [Ollama](https://github.com/ollama/ollama) — Production-grade local LLM server + CLI. Study `server/` and `api/` packages for: HTTP API design, subprocess management, CLI structure. Difficulty: Intermediate, large codebase.

### Study Projects (Backend / Infrastructure)

- [go-chi/chi](https://github.com/go-chi/chi) — Lightweight, idiomatic HTTP router. Best learning router: `net/http`-compatible, minimal magic. Study for: composable middleware, route grouping, context patterns. Difficulty: Beginner.
- [pgx](https://github.com/jackc/pgx) — Pure-Go PostgreSQL driver. De facto standard. Study for: connection pooling, prepared statements, database/sql interface. Difficulty: Beginner (usage) / Advanced (internals).
- [sqlc](https://github.com/sqlc-dev/sqlc) — SQL-first code generation. Compiles SQL into type-safe Go. Study generated code for idiomatic patterns. Difficulty: Beginner (usage).
- [golang-migrate/migrate](https://github.com/golang-migrate/migrate) — Database migration CLI and library. Study for: versioned up/down migration files, schema rollout workflow, and operational safety. Difficulty: Beginner.
- [grpc-go](https://github.com/grpc/grpc-go) — Official Go implementation of gRPC. Study for: generated service interfaces, interceptors, health checks, streaming, and HTTP/2 RPC internals. Difficulty: Intermediate.
- [connect-go](https://github.com/connectrpc/connect-go) — Modern Protobuf RPC over `net/http`, compatible with gRPC and gRPC-Web. Study for: browser-friendly RPC, handler/client generation, and simpler deployment ergonomics. Difficulty: Intermediate.
- [PocketBase](https://github.com/pocketbase/pocketbase) — Single-binary backend (HTTP + SQLite + file storage). Study for: embedded databases, SSE, project layout, concurrency patterns. Difficulty: Intermediate.
- [GitHub CLI (gh)](https://github.com/cli/cli) — Canonical large Go CLI. Study `pkg/cmd/` for: Cobra command trees, API client layering, formatting, testing. Difficulty: Intermediate.

## Wisdom (Communities)

- [r/golang](https://reddit.com/r/golang) — General Go subreddit. Mixed signal but good for discovering projects and patterns.
- [Gopher Slack](https://invite.slack.golangbridge.org/) — Official Go community Slack. Use for: quick questions, ecosystem knowledge.
- [Go Weekly](https://golangweekly.com/) — Curated newsletter of Go articles, releases, and projects.

## Gaps

- No identified Agent-framework-level Go project suitable for beginners. langchaingo is the closest but assumes intermediate Go. May need to teach up to it.
