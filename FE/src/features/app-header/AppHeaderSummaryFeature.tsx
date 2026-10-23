import { useCallback, useEffect, useState } from "react";

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
  const [isProgressPopoverOpen, setIsProgressPopoverOpen] = useState(false);
  const closeProgressPopover = useCallback(
    () => setIsProgressPopoverOpen(false),
    [],
  );
  const weddingDate = useWeddingDate({
    onAuthenticationRequired,
    repository: weddingDateRepository,
  });

  const [previousNavigationKey, setPreviousNavigationKey] =
    useState(navigationKey);
  if (previousNavigationKey !== navigationKey) {
    setPreviousNavigationKey(navigationKey);
    closeProgressPopover();
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
        setIsProgressPopoverOpen(false);
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
      isProgressPopoverOpen={isProgressPopoverOpen}
      isSaving={weddingDate.isSaving}
      onClosePopover={weddingDate.closePopover}
      onCloseProgressPopover={closeProgressPopover}
      onOpenPopover={() => {
        closeProgressPopover();
        weddingDate.openPopover();
      }}
      onRetryWeddingDate={weddingDate.retryLoad}
      onSaveWeddingDate={weddingDate.save}
      onToggleProgressPopover={() => {
        weddingDate.closePopover();
        setIsProgressPopoverOpen((open) => !open);
      }}
      saveError={weddingDate.saveError}
      viewModel={viewModel}
      weddingDate={weddingDate.currentDate}
    />
  );
}
