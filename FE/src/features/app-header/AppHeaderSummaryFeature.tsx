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
  navigationKey?: string;
}

export function AppHeaderSummaryFeature({
  onAuthenticationRequired,
  navigationKey,
}: AppHeaderSummaryFeatureProps) {
  const summaryRepository = useAppHeaderSummaryRepository();
  const weddingDateRepository = useWeddingDateRepository();
  const checklistRevision = useAppHeaderChecklistRevision();
  const [summary, setSummary] = useState<AppHeaderSummaryModel | null>(null);
  const [isProgressExpanded, setIsProgressExpanded] = useState(false);
  const weddingDate = useWeddingDate({
    onAuthenticationRequired,
    repository: weddingDateRepository,
  });

  const [previousNavigationKey, setPreviousNavigationKey] =
    useState(navigationKey);
  if (previousNavigationKey !== navigationKey) {
    setPreviousNavigationKey(navigationKey);
    setIsProgressExpanded(false);
    weddingDate.closePopover();
  }

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
        setIsProgressExpanded(false);
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
      isProgressExpanded={isProgressExpanded}
      isSaving={weddingDate.isSaving}
      onClosePopover={weddingDate.closePopover}
      onOpenPopover={() => {
        setIsProgressExpanded(false);
        weddingDate.openPopover();
      }}
      onRetryWeddingDate={weddingDate.retryLoad}
      onSaveWeddingDate={weddingDate.save}
      onProgressExpandedChange={(expanded) => {
        weddingDate.closePopover();
        setIsProgressExpanded(expanded);
      }}
      saveError={weddingDate.saveError}
      viewModel={viewModel}
      weddingDate={weddingDate.currentDate}
    />
  );
}
