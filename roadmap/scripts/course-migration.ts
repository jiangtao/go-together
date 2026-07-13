import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  applyMigrationPlan,
  createMigrationBaseline,
  isPathInside,
  planMigration,
  rollbackMigration,
  type MigrationBaseline,
  type MigrationPlan,
  type MigrationRequest,
} from "./lib/course-migration.ts"

type Command = "baseline" | "plan" | "apply" | "rollback"

interface ParsedArguments {
  command: Command
  values: Map<string, string[]>
}

const COMMANDS = new Set<Command>([
  "baseline",
  "plan",
  "apply",
  "rollback",
])

function usage(): string {
  return [
    "Usage:",
    "  course-migration baseline --workspace <dir> --backup <external-dir> --root <path> [--root <path>...]",
    "  course-migration plan --workspace <dir> --backup <external-dir> --request <json> --output <external-json>",
    "  course-migration apply --workspace <dir> --backup <external-dir> --plan <json> --journal <external-json>",
    "  course-migration rollback --workspace <dir> --backup <external-dir> --plan <json> --journal <external-json>",
  ].join("\n")
}

function parseArguments(argv: string[]): ParsedArguments {
  const [candidate, ...tokens] = argv
  if (!candidate || !COMMANDS.has(candidate as Command)) {
    throw new Error(usage())
  }
  const values = new Map<string, string[]>()
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index]
    const value = tokens[index + 1]
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`invalid arguments\n${usage()}`)
    }
    const key = flag.slice(2)
    const entries = values.get(key) ?? []
    entries.push(value)
    values.set(key, entries)
  }
  return { command: candidate as Command, values }
}

function one(
  arguments_: ParsedArguments,
  name: string,
  options: { repeated?: boolean } = {}
): string {
  const values = arguments_.values.get(name) ?? []
  if (values.length === 0) throw new Error(`missing --${name}\n${usage()}`)
  if (!options.repeated && values.length !== 1) {
    throw new Error(`--${name} must be provided exactly once`)
  }
  return values[0]!
}

function assertKnownFlags(
  arguments_: ParsedArguments,
  allowed: readonly string[]
): void {
  const allowedSet = new Set(allowed)
  const unknown = [...arguments_.values.keys()].filter(
    (key) => !allowedSet.has(key)
  )
  if (unknown.length) throw new Error(`unknown flags: ${unknown.join(", ")}`)
}

function assertExternalArtifact(workspace: string, artifact: string): string {
  const resolved = path.resolve(artifact)
  if (isPathInside(workspace, resolved)) {
    throw new Error("migration artifacts must remain outside the workspace")
  }
  return resolved
}

async function readJson<T>(file: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path.resolve(file), "utf8")) as T
  } catch (error) {
    throw new Error(`cannot read migration JSON: ${(error as Error).message}`)
  }
}

async function writeNewJson(file: string, value: unknown): Promise<void> {
  const resolved = path.resolve(file)
  await mkdir(path.dirname(resolved), { recursive: true })
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  })
}

function baselineFile(backupDirectory: string): string {
  return path.join(path.resolve(backupDirectory), "baseline.json")
}

export async function runCourseMigration(argv: string[]): Promise<unknown> {
  const arguments_ = parseArguments(argv)
  const workspace = path.resolve(one(arguments_, "workspace"))
  const backupDirectory = assertExternalArtifact(
    workspace,
    one(arguments_, "backup")
  )

  if (arguments_.command === "baseline") {
    assertKnownFlags(arguments_, ["workspace", "backup", "root"])
    const roots = arguments_.values.get("root") ?? []
    if (roots.length === 0) throw new Error("baseline requires --root")
    const baseline = await createMigrationBaseline({
      workspace,
      backupDirectory,
      roots,
    })
    return {
      command: "baseline",
      fingerprint: baseline.fingerprint,
      fileCount: baseline.files.length,
      privateTrackedCount: baseline.privacy.trackedPaths.length,
      listener5173: baseline.listener5173.status,
    }
  }

  const baseline = await readJson<MigrationBaseline>(
    baselineFile(backupDirectory)
  )
  if (arguments_.command === "plan") {
    assertKnownFlags(arguments_, [
      "workspace",
      "backup",
      "request",
      "output",
    ])
    const output = assertExternalArtifact(
      workspace,
      one(arguments_, "output")
    )
    const request = await readJson<MigrationRequest>(one(arguments_, "request"))
    const plan = await planMigration({ workspace, baseline, request })
    await writeNewJson(output, plan)
    return {
      command: "plan",
      fingerprint: plan.fingerprint,
      identityCount: plan.identities.length,
      operationCount: plan.operations.length,
    }
  }

  assertKnownFlags(arguments_, [
    "workspace",
    "backup",
    "plan",
    "journal",
  ])
  const planFile = path.resolve(one(arguments_, "plan"))
  const plan = await readJson<MigrationPlan>(planFile)
  const journalFile = assertExternalArtifact(
    workspace,
    one(arguments_, "journal")
  )
  if (arguments_.command === "apply") {
    await applyMigrationPlan({
      workspace,
      backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    return { command: "apply", fingerprint: plan.fingerprint }
  }

  await rollbackMigration({
    workspace,
    backupDirectory,
    baseline,
    plan,
    journalFile,
  })
  return { command: "rollback", fingerprint: plan.fingerprint }
}

async function main(): Promise<void> {
  const result = await runCourseMigration(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
}
