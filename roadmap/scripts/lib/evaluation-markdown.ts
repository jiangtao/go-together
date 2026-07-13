import { parseEvaluationRecord, type EvaluationRecord } from "./course-contract.ts"

type JsonRecord = Record<string, unknown>

const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const STATUS = new Set(["未开始", "定向回炉", "重新学习", "通过"])
const PROBLEM_TYPES = new Set([
  "概念混淆",
  "机制缺失",
  "边界不清",
  "证据不足",
  "已达标",
])

function object(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} 必须是对象`)
  }
  return value as JsonRecord
}

function exact(value: JsonRecord, keys: string[], context: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${context} 字段不精确`)
  }
}

function integer(
  value: unknown,
  minimum: number,
  maximum: number,
  context: string
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${context} 必须是 ${minimum}-${maximum} 整数`)
  }
  return Number(value)
}

function id(value: unknown, context: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error(`${context} 必须是 kebab-case ID`)
  }
  return value
}

interface ParsedCompetency {
  competencyId: string
  score: number
  attempts: number
}

interface ParsedCycle {
  cycle: number
  evaluationRevision: string
  status: "未开始" | "定向回炉" | "重新学习" | "通过"
  referenceScore: number | null
  currentCompetencyId: string | null
  competencies: ParsedCompetency[]
}

function parseCycle(value: unknown, index: number): ParsedCycle {
  const context = `Evaluation cycle[${index}]`
  const cycle = object(value, context)
  exact(
    cycle,
    [
      "cycle",
      "evaluationRevision",
      "status",
      "referenceScore",
      "currentCompetencyId",
      "competencies",
    ],
    context
  )
  if (cycle.cycle !== index + 1) throw new Error(`${context}.cycle 顺序无效`)
  if (
    typeof cycle.evaluationRevision !== "string" ||
    !REVISION_PATTERN.test(cycle.evaluationRevision)
  ) {
    throw new Error(`${context}.evaluationRevision 无效`)
  }
  if (typeof cycle.status !== "string" || !STATUS.has(cycle.status)) {
    throw new Error(`${context}.status 无效`)
  }
  if (!Array.isArray(cycle.competencies) || cycle.competencies.length === 0) {
    throw new Error(`${context}.competencies 必须非空`)
  }
  const competencies = cycle.competencies.map((candidate, competencyIndex) => {
    const competencyContext = `${context}.competencies[${competencyIndex}]`
    const competency = object(candidate, competencyContext)
    exact(
      competency,
      ["competencyId", "score", "attempts"],
      competencyContext
    )
    return {
      competencyId: id(competency.competencyId, `${competencyContext}.competencyId`),
      score: integer(competency.score, 0, 4, `${competencyContext}.score`),
      attempts: integer(
        competency.attempts,
        0,
        3,
        `${competencyContext}.attempts`
      ),
    }
  })
  if (new Set(competencies.map(({ competencyId }) => competencyId)).size !== competencies.length) {
    throw new Error(`${context} competencyId 重复`)
  }
  const calculated = Math.round(
    (competencies.reduce((sum, competency) => sum + competency.score, 0) * 100) /
      (competencies.length * 4)
  )
  const status = cycle.status as ParsedCycle["status"]
  if (status === "未开始") {
    if (
      cycle.referenceScore !== null ||
      competencies.some(({ score, attempts }) => score !== 0 || attempts !== 0)
    ) {
      throw new Error(`${context} 未开始快照无效`)
    }
  } else if (cycle.referenceScore !== calculated) {
    throw new Error(`${context}.referenceScore 与能力等级不一致`)
  }
  const below = competencies.filter(({ score }) => score < 3)
  if (status === "通过" && below.length > 0) {
    throw new Error(`${context} 通过时全部能力必须至少 3`)
  }
  if (
    status === "重新学习" &&
    !below.some(({ attempts }) => attempts === 3)
  ) {
    throw new Error(`${context} 重新学习必须有三次未达标能力`)
  }
  if (
    status === "定向回炉" &&
    (below.length === 0 || below.some(({ attempts }) => attempts === 3))
  ) {
    throw new Error(`${context} 定向回炉尝试状态无效`)
  }
  const expectedCurrent = below[0]?.competencyId ?? null
  if (cycle.currentCompetencyId !== expectedCurrent) {
    throw new Error(`${context}.currentCompetencyId 无效`)
  }
  return {
    cycle: index + 1,
    evaluationRevision: cycle.evaluationRevision,
    status,
    referenceScore:
      cycle.referenceScore === null
        ? null
        : integer(cycle.referenceScore, 0, 100, `${context}.referenceScore`),
    currentCompetencyId: expectedCurrent,
    competencies,
  }
}

function parseEvents(value: unknown, cycles: ParsedCycle[]): void {
  if (!Array.isArray(value)) throw new Error("Evaluation events 必须是数组")
  const maximumAttempts = new Map<string, number>()
  const latestScores = new Map<string, number>()
  let activeCycle: number | null = null
  value.forEach((candidate, index) => {
    const context = `Evaluation event[${index}]`
    const event = object(candidate, context)
    if (event.sequence !== index + 1) throw new Error(`${context}.sequence 无效`)
    if (event.type === "cycle-started") {
      exact(event, ["sequence", "type", "cycle"], context)
      const cycleNumber = integer(event.cycle, 1, cycles.length, `${context}.cycle`)
      if (cycleNumber !== (activeCycle ?? 0) + 1) {
        throw new Error(`${context}.cycle 启动顺序无效`)
      }
      activeCycle = cycleNumber
      return
    }
    if (event.type === "security-stop") {
      exact(event, ["sequence", "type", "cycle", "reason"], context)
      if (event.cycle !== activeCycle) {
        throw new Error(`${context}.cycle 无效`)
      }
      if (event.reason !== "sensitive-content") {
        throw new Error(`${context}.reason 无效`)
      }
      return
    }
    if (event.type === "outcome") {
      exact(
        event,
        [
          "sequence",
          "type",
          "cycle",
          "competencyId",
          "score",
          "attempt",
          "problemType",
          "evidenceLocation",
          "reviewSection",
        ],
        context
      )
      const cycleNumber = integer(event.cycle, 1, cycles.length, `${context}.cycle`)
      if (cycleNumber !== activeCycle) {
        throw new Error(`${context}.cycle 不是当前评测周期`)
      }
      const competencyId = id(event.competencyId, `${context}.competencyId`)
      if (
        !cycles[cycleNumber - 1].competencies.some(
          (competency) => competency.competencyId === competencyId
        )
      ) {
        throw new Error(`${context}.competencyId 不属于该评测周期`)
      }
      const score = integer(event.score, 0, 4, `${context}.score`)
      const attempt = integer(event.attempt, 1, 3, `${context}.attempt`)
      for (const field of ["problemType", "evidenceLocation", "reviewSection"] as const) {
        if (
          typeof event[field] !== "string" ||
          event[field].length === 0 ||
          event[field].length > 120 ||
          /[\r\n\0]/.test(event[field])
        ) {
          throw new Error(`${context}.${field} 无效`)
        }
      }
      if (!PROBLEM_TYPES.has(String(event.problemType))) {
        throw new Error(`${context}.problemType 无效`)
      }
      const key = `${cycleNumber}\0${competencyId}`
      const previous = maximumAttempts.get(key) ?? 0
      if (attempt !== previous + 1) throw new Error(`${context}.attempt 不连续`)
      maximumAttempts.set(key, attempt)
      latestScores.set(key, score)
      return
    }
    throw new Error(`${context}.type 无效`)
  })
  if (activeCycle !== (cycles.length === 0 ? null : cycles.length)) {
    throw new Error("Evaluation cycle-started 历史不完整")
  }
  cycles.forEach((cycle) => {
    cycle.competencies.forEach((competency) => {
      const observed = maximumAttempts.get(
        `${cycle.cycle}\0${competency.competencyId}`
      ) ?? 0
      if (observed !== competency.attempts) {
        throw new Error(
          `Evaluation cycle[${cycle.cycle - 1}] attempts 与事件不一致`
        )
      }
      const observedScore = latestScores.get(
        `${cycle.cycle}\0${competency.competencyId}`
      ) ?? 0
      if (observedScore !== competency.score) {
        throw new Error(
          `Evaluation cycle[${cycle.cycle - 1}] score 与事件不一致`
        )
      }
    })
  })
}

export function parseEvaluationMarkdown(source: string): EvaluationRecord | null {
  const matches = [...source.matchAll(/^```evaluation-record\n([\s\S]*?)\n```$/gm)]
  if (matches.length !== 1) {
    throw new Error("Evaluation Markdown 必须包含唯一 evaluation-record 块")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(matches[0][1])
  } catch {
    throw new Error("evaluation-record 不是合法 JSON")
  }
  const record = object(parsed, "Evaluation Record")
  exact(
    record,
    [
      "schemaVersion",
      "courseId",
      "lessonId",
      "legacySourceBase64",
      "cycles",
      "events",
    ],
    "Evaluation Record"
  )
  if (record.schemaVersion !== 2) {
    throw new Error("Evaluation Record schemaVersion 必须为 2")
  }
  const courseId = id(record.courseId, "Evaluation courseId")
  const lessonId = id(record.lessonId, "Evaluation lessonId")
  if (
    record.legacySourceBase64 !== null &&
    (typeof record.legacySourceBase64 !== "string" ||
      record.legacySourceBase64.length > 2_000_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        record.legacySourceBase64
      ))
  ) {
    throw new Error("Evaluation legacySourceBase64 无效")
  }
  if (!Array.isArray(record.cycles)) throw new Error("Evaluation cycles 必须是数组")
  const cycles = record.cycles.map(parseCycle)
  parseEvents(record.events, cycles)
  if (cycles.length === 0) return null
  return parseEvaluationRecord({
    schemaVersion: 1,
    courseId,
    lessonId,
    history: cycles.map((cycle) => ({
      evaluationRevision: cycle.evaluationRevision,
      status: cycle.status,
      referenceScore: cycle.referenceScore,
      competencies: cycle.competencies.map(({ competencyId, score }) => ({
        competencyId,
        score,
      })),
    })),
  })
}
