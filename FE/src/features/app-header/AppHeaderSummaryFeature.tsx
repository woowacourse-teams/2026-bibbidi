import { useEffect, useState } from "react";

import {
  useAppHeaderChecklistRevision,
  useAppHeaderSummaryRepository,
  useWeddingDateRepository,
} from "./appHeaderDependencies";
import { AppHeaderSummaryModel } from "./model/appHeaderSummary";
import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryRequestAbortedError,
} from "./repository/appHeaderSummaryRepository";
import { useWeddingDate } from "./useWeddingDate";
import { createAppHeaderSummaryViewModel } from "./view-model/createAppHeaderSummaryViewModel";
import { AppHeaderSummary } from "./view/AppHeaderSummary";

interface AppHeaderSummaryFeatureProps {
  onAuthenticationRequired: () => void;
}

export function AppHeaderSummaryFeature({
  onAuthenticationRequired,
}: AppHeaderSummaryFeatureProps) {
  const summaryRepository = useAppHeaderSummaryRepository();
  const weddingDateRepository = useWeddingDateRepository();
  const checklistRevision = useAppHeaderChecklistRevision();
  const [summary, setSummary] = useState<AppHeaderSummaryModel | null>(null);
  const weddingDate = useWeddingDate({
    onAuthenticationRequired,
    repository: weddingDateRepository,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    summaryRepository
      .getSummary(controller.signal)
      .then((nextSummary) => {
        if (isActive) {
          setSummary(nextSummary);
        }
      })
      .catch((error: unknown) => {
        if (!isActive || error instanceof AppHeaderSummaryRequestAbortedError) {
          return;
        }

        setSummary(null);
        if (error instanceof AppHeaderAuthenticationRequiredError) {
          onAuthenticationRequired();
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [checklistRevision, onAuthenticationRequired, summaryRepository]);

  const viewModel = createAppHeaderSummaryViewModel(
    summary,
    weddingDate.loadState,
  );

  return (
    <AppHeaderSummary
      isPopoverOpen={weddingDate.isPopoverOpen}
      isSaving={weddingDate.isSaving}
      onClosePopover={weddingDate.closePopover}
      onOpenPopover={weddingDate.openPopover}
      onRetryWeddingDate={weddingDate.retryLoad}
      onSaveWeddingDate={weddingDate.save}
      saveError={weddingDate.saveError}
      viewModel={viewModel}
      weddingDate={weddingDate.currentDate}
    />
  );
}
