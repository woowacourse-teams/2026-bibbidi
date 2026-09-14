import { useEffect, useState } from "react";

import { useAppHeaderSummaryRepository } from "./appHeaderDependencies";
import { AppHeaderSummaryModel } from "./model/appHeaderSummary";
import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryRequestAbortedError,
} from "./repository/appHeaderSummaryRepository";
import { createAppHeaderSummaryViewModel } from "./view-model/createAppHeaderSummaryViewModel";
import { AppHeaderSummary } from "./view/AppHeaderSummary";

interface AppHeaderSummaryFeatureProps {
  onAuthenticationRequired: () => void;
}

export function AppHeaderSummaryFeature({
  onAuthenticationRequired,
}: AppHeaderSummaryFeatureProps) {
  const repository = useAppHeaderSummaryRepository();
  const [summary, setSummary] = useState<AppHeaderSummaryModel | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    repository
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
  }, [onAuthenticationRequired, repository]);

  const viewModel = createAppHeaderSummaryViewModel(summary);

  return <AppHeaderSummary viewModel={viewModel} />;
}
