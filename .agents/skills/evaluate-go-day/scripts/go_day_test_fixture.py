import json
from pathlib import Path


def write_course_fixture(workspace: Path, *, create_notes: bool = False) -> None:
    course_root = workspace / "courses/go-backend"
    (course_root / "lessons").mkdir(parents=True)
    (course_root / "evaluation").mkdir()
    (workspace / "courses/catalog.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "defaultCourseId": "go-backend",
                "courses": [
                    {
                        "courseId": "go-backend",
                        "title": "Go Course",
                        "language": {"id": "go", "label": "Go"},
                        "lifecycle": "published",
                        "replacementCourseId": None,
                        "manifestPath": "courses/go-backend/course.json",
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (course_root / "course.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "courseId": "go-backend",
                "title": "Go Course",
                "description": "Fixture",
                "language": {"id": "go", "label": "Go"},
                "lifecycle": "published",
                "replacementCourseId": None,
                "evaluationPolicyPath": "evaluation/policy.md",
                "commandProfilePath": "evaluation/command-profile.json",
                "publicResources": [],
                "internalResources": [],
                "tracks": [
                    {
                        "trackId": "fundamentals",
                        "title": "Fundamentals",
                        "description": "Fixture",
                        "stages": [
                            {
                                "stageId": "start",
                                "title": "Start",
                                "description": "Fixture",
                                "lessons": [
                                    {
                                        "lessonId": "intro",
                                        "lifecycle": "active",
                                        "day": 0,
                                        "title": "Intro",
                                        "objective": "Learn this lesson.",
                                        "goals": ["Explain it."],
                                        "contentPath": "lessons/intro.md",
                                        "exerciseTemplatePath": None,
                                        "evaluation": {
                                            "competencies": [
                                                {
                                                    "competencyId": "lesson-requirements",
                                                    "title": "Complete requirements",
                                                }
                                            ],
                                            "requiredEvidence": ["notes"],
                                            "scoringBasis": ["accurate"],
                                        },
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (course_root / "lessons/intro.md").write_text("# Intro\n", encoding="utf-8")
    (course_root / "evaluation/policy.md").write_text(
        "# Policy\n", encoding="utf-8"
    )
    (course_root / "evaluation/command-profile.json").write_text(
        '{"schemaVersion":1,"profileId":"go-local","environment":{},"commands":[]}\n',
        encoding="utf-8",
    )
    if create_notes:
        record = workspace / "learning-records/go-backend/lessons/intro"
        record.mkdir(parents=True)
        (record / "notes.md").write_text("# Notes\n", encoding="utf-8")
