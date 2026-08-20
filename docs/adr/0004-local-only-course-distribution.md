# 课程发现性与分发范围分离

**Status:** accepted

Lifecycle 表达课程是否可用，`visibility` 表达已投影课程能否从界面发现，`distribution` 表达课程能否进入部署产物。三者保持正交，避免把 Published 倒退为 Draft，也避免误把 `unlisted` 当作隐私边界。

`algorithm` 保持 `lifecycle: published` 与 `visibility: unlisted`，同时设为 `distribution: local-only`。`generate:local` 与 `dev` 可生成它供 `/courses/algorithm` 本地直达；`generate:public`、Vite `dist` 和 Vercel prebuilt 只接受 `distribution: public`，并通过确定性生成与审计保证 local-only Course 零文件。

## English

Lifecycle describes whether a course is usable, `visibility` describes whether a projected course is discoverable in the UI, and `distribution` controls whether it may enter deployable artifacts. These concerns remain orthogonal so a Published course does not need to regress to Draft and `unlisted` is never mistaken for a privacy boundary.

`algorithm` remains Published and Unlisted but uses `distribution: local-only`. `generate:local` and `dev` may project it for direct access at `/courses/algorithm`; `generate:public`, Vite `dist`, and the Vercel prebuilt package accept only public-distribution courses and must contain zero local-only course files.
