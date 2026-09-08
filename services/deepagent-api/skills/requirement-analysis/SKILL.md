---
name: requirement-analysis
description: Analyze a product or software requirement for completeness, risks, scope, and testable acceptance criteria. Use when a request asks for requirement review, implementation planning, risk assessment, or Given-When-Then acceptance criteria.
---

# Requirement analysis

Use this skill to turn an unstructured requirement into an evidence-based engineering brief.

## Required workflow

1. Read the original requirement without inventing business facts.
2. Call `analyze_completeness` and `estimate_complexity` when those tools are available.
3. Separate facts, assumptions, open questions, and recommendations.
4. Review the six dimensions in [references/scoring-rubric.md](references/scoring-rubric.md).
5. Write acceptance criteria as observable Given-When-Then statements.
6. Use [assets/report-template.md](assets/report-template.md) as the final report structure.

## Quality rules

- Treat missing information as an open question, never as an implicit fact.
- Give every risk a severity, trigger, impact, and mitigation.
- Make each acceptance criterion independently testable.
- Keep estimates as ranges and list the factors that drive them.
- Do not change code, call external systems, or perform the requested business operation. This skill only analyzes the requirement.
