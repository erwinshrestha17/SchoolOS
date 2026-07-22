import type { ClassSummary, EducationProgram } from "@schoolos/core";

export function educationProgramLabel(program: EducationProgram | null) {
  if (program === "SCHOOL") return "School · Grade 1–10";
  if (program === "HIGHER_SECONDARY") {
    return "Higher Secondary · Grade 11–12 / +2";
  }
  return "Program unavailable";
}

export function classOptionLabel(
  schoolClass: Pick<ClassSummary, "name" | "program">,
) {
  return `${schoolClass.name} — ${educationProgramLabel(schoolClass.program ?? null)}`;
}
