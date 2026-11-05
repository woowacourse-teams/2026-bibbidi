import { useContext, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";

import { useAuth } from "../features/auth";
import { HomeEntryPageViewContext } from "../app/analytics/AppPageViewTracker";
import {
  resolveHomeEntryVariant,
  type HomeEntryVariant,
} from "../infrastructure/analytics";
import { PreparationCatalogPage } from "./PreparationCatalogPage";

export function HomeEntryPage() {
  const { authState } = useAuth();
  const [searchParams] = useSearchParams();
  const [variant, setVariant] = useState<HomeEntryVariant | null>(null);
  const hasCategoryLink = searchParams.has("categoryId");
  const trackHomeEntryPageView = useContext(HomeEntryPageViewContext);

  useEffect(() => {
    if (hasCategoryLink) return;
    if (authState.status === "loading" || authState.status === "synchronizing")
      return;
    if (authState.status === "error") return;

    let active = true;
    resolveHomeEntryVariant().then(
      (result) => {
        if (active) setVariant(result);
      },
      () => {
        if (active) setVariant("control");
      },
    );
    return () => {
      active = false;
    };
  }, [authState.status, hasCategoryLink]);

  useEffect(() => {
    if (
      (hasCategoryLink || variant === "control") &&
      authState.status !== "loading" &&
      authState.status !== "synchronizing" &&
      authState.status !== "error"
    ) {
      trackHomeEntryPageView?.();
    }
  }, [authState.status, hasCategoryLink, trackHomeEntryPageView, variant]);

  if (
    hasCategoryLink ||
    authState.status === "error" ||
    variant === "control"
  ) {
    return <PreparationCatalogPage />;
  }
  if (variant === "test") {
    return <Navigate replace to="/calendar" />;
  }
  return <main aria-label="첫 화면 준비 중" role="status" />;
}
