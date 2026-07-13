import { describe, expect, it } from "vitest"

import { parseEvaluationMarkdown } from "./evaluation-markdown.ts"

function markdown(record: unknown): string {
  return `# Evaluation Record\n\n\`\`\`evaluation-record\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
}

interface EvaluationFixture {
  schemaVersion: number
  courseId: string
  lessonId: string
  legacySourceBase64: string | null
  cycles: Array<{
    cycle: number
    evaluationRevision: string
    status: string
    referenceScore: number | null
    currentCompetencyId: string | null
    competencies: Array<{
      competencyId: string
      score: number
      attempts: number
    }>
  }>
  events: Array<Record<string, unknown>>
}

function record(): EvaluationFixture {
  return {
    schemaVersion: 2,
    courseId: "go-backend",
    lessonId: "intro",
    legacySourceBase64: null,
    cycles: [
      {
        cycle: 1,
        evaluationRevision: `sha256:${"a".repeat(64)}`,
        status: "通过",
        referenceScore: 88,
        currentCompetencyId: null,
        competencies: [
          { competencyId: "mechanism", score: 4, attempts: 1 },
          { competencyId: "evidence", score: 3, attempts: 2 },
        ],
      },
    ],
    events: [
      { sequence: 1, type: "cycle-started", cycle: 1 },
      {
        sequence: 2,
        type: "outcome",
        cycle: 1,
        competencyId: "mechanism",
        score: 4,
        attempt: 1,
        problemType: "已达标",
        evidenceLocation: "回答 1",
        reviewSection: "机制",
      },
      {
        sequence: 3,
        type: "outcome",
        cycle: 1,
        competencyId: "evidence",
        score: 2,
        attempt: 1,
        problemType: "证据不足",
        evidenceLocation: "验证证据",
        reviewSection: "实践",
      },
      {
        sequence: 4,
        type: "outcome",
        cycle: 1,
        competencyId: "evidence",
        score: 3,
        attempt: 2,
        problemType: "已达标",
        evidenceLocation: "验证证据",
        reviewSection: "实践",
      },
      {
        sequence: 5,
        type: "security-stop",
        cycle: 1,
        reason: "sensitive-content",
      },
    ],
  }
}

describe("Evaluation Markdown v2", () => {
  it("projects the private Markdown record to the existing progress contract", () => {
    expect(parseEvaluationMarkdown(markdown(record()))).toEqual({
      schemaVersion: 1,
      courseId: "go-backend",
      lessonId: "intro",
      history: [
        {
          evaluationRevision: `sha256:${"a".repeat(64)}`,
          status: "通过",
          referenceScore: 88,
          competencies: [
            { competencyId: "mechanism", score: 4 },
            { competencyId: "evidence", score: 3 },
          ],
        },
      ],
    })
  })

  it("treats a security-only record as no valid Evaluation", () => {
    const value = record()
    value.cycles = []
    value.events = [
      {
        sequence: 1,
        type: "security-stop",
        cycle: null,
        reason: "sensitive-content",
      },
    ]
    expect(parseEvaluationMarkdown(markdown(value))).toBeNull()
  })

  it("rejects hidden answer fields, invalid attempts, status-score drift and extra prose blocks", () => {
    const answer = record()
    answer.events[1] = { ...answer.events[1], answer: "secret answer" }
    expect(() => parseEvaluationMarkdown(markdown(answer))).toThrow("字段")

    const attempts = record()
    attempts.cycles[0].competencies[0].attempts = 4
    expect(() => parseEvaluationMarkdown(markdown(attempts))).toThrow("attempts")

    const drift = record()
    drift.cycles[0].referenceScore = 50
    expect(() => parseEvaluationMarkdown(markdown(drift))).toThrow("referenceScore")

    const unknownCompetency = record()
    unknownCompetency.events.splice(4, 0, {
      sequence: 5,
      type: "outcome",
      cycle: 1,
      competencyId: "invented",
      score: 3,
      attempt: 1,
      problemType: "已达标",
      evidenceLocation: "回答",
      reviewSection: "机制",
    })
    unknownCompetency.events[5] = {
      ...unknownCompetency.events[5],
      sequence: 6,
    }
    expect(() => parseEvaluationMarkdown(markdown(unknownCompetency))).toThrow(
      "competency"
    )

    const snapshotDrift = record()
    snapshotDrift.events[3] = { ...snapshotDrift.events[3], score: 4 }
    expect(() => parseEvaluationMarkdown(markdown(snapshotDrift))).toThrow(
      "事件"
    )

    expect(() =>
      parseEvaluationMarkdown(
        `${markdown(record())}\n\`\`\`evaluation-record\n{}\n\`\`\`\n`
      )
    ).toThrow("唯一")
  })
})
