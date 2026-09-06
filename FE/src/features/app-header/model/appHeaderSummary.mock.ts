import { AppHeaderSummaryModel } from "./appHeaderSummary";
import { weddingReferenceDateMock } from "../../../domain/wedding/weddingReferenceDate.mock";

export const appHeaderSummaryMock: AppHeaderSummaryModel = {
  completedTaskCount: 36,
  referenceDate: weddingReferenceDateMock,
  totalTaskCount: 75,
  weddingDate: "2027-02-20",
};
