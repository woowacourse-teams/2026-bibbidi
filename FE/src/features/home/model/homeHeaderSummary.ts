export interface HomeHeaderSummaryModel {
  completedTaskCount: number;
  referenceDate: string;
  totalTaskCount: number;
  weddingDate: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateAsUtc(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

export function calculateDaysUntilWedding(
  referenceDate: string,
  weddingDate: string,
) {
  return Math.round(
    (parseDateAsUtc(weddingDate) - parseDateAsUtc(referenceDate)) /
      MILLISECONDS_PER_DAY,
  );
}

export function calculatePreparationProgress(
  completedTaskCount: number,
  totalTaskCount: number,
) {
  if (totalTaskCount <= 0) {
    return 0;
  }

  const progress = Math.round((completedTaskCount / totalTaskCount) * 100);

  return Math.min(100, Math.max(0, progress));
}
