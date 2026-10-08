export type MarkScores = {
  class_test_score: number | null;
  project_score: number | null;
  homework_score: number | null;
  group_work_score: number | null;
  exam_score: number | null;
};

export function calculateMarkResult(scores: MarkScores) {
  if (
    scores.class_test_score === null ||
    scores.project_score === null ||
    scores.homework_score === null ||
    scores.group_work_score === null ||
    scores.exam_score === null
  ) {
    return { total_score: null, performance_level: null };
  }

  const total =
    scores.class_test_score +
    scores.project_score +
    scores.homework_score +
    scores.group_work_score +
    scores.exam_score / 2;
  const performanceLevel =
    total >= 80 ? "HP" : total >= 68 ? "P" : total >= 54 ? "AP" : total >= 40 ? "D" : "E";

  return { total_score: total, performance_level: performanceLevel };
}
