# Mission

**Goal**: Produce a self-contained Go training curriculum that takes the user from their existing Node + SQL background to production-grade Go fluency, targeting Agent development and backend systems as the primary application domains.

**Primary teaching method**: Node.js → Go analogy mapping. Every concept is introduced through its Node.js equivalent first, then contrasted with Go's approach. This leverages existing mental models rather than building from scratch.

## Context

- The user is an experienced Node.js backend developer with SQL modeling and database design experience
- They understand HTTP services, APIs, databases, and general software engineering practices
- Go is new to them — they need to learn Go-specific idioms, patterns, and ecosystem, not general programming
- **Target domains**: Agent/AI application development, backend service development
- **Training approach**: Study and rebuild patterns from real open-source Go projects — no user-owned projects

## Deliverable

A sequenced set of lessons, each self-contained and practical, that together form a complete "Go industrial development" curriculum. Each lesson teaches one tightly-scoped skill, builds on prior lessons, and includes interactive practice. Lessons use open-source Go projects (especially in the Agent and backend space) as reference implementations.

## Success looks like

The user can confidently build, test, deploy, and maintain a production Go service — including project structure, concurrency, error handling, database access, observability, and performance awareness. They can read and contribute to real-world Go projects in the Agent and backend ecosystems.

## Constraints

- Lessons should be completable quickly (working memory is small)
- Each lesson links to the MISSION so the user always knows why they're learning it
- Prioritize hands-on skills over theory
- Assume the user will write actual Go code in every lesson
- Reference open-source projects as study material, not the user's own code
