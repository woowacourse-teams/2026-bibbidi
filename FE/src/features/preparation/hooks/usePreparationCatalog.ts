import { useEffect, useState } from "react";

import { catalogRepository, type CatalogModel } from "../../catalog";

type CatalogRequest =
  | { status: "loading" | "error" }
  | { status: "success"; catalog: CatalogModel };

export function usePreparationCatalog(initialCatalog?: CatalogModel) {
  const [request, setRequest] = useState<CatalogRequest>({ status: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (initialCatalog) return;

    const controller = new AbortController();
    void catalogRepository.getCatalog(controller.signal).then(
      (catalog) => {
        if (!controller.signal.aborted)
          setRequest({ status: "success", catalog });
      },
      () => {
        if (!controller.signal.aborted) setRequest({ status: "error" });
      },
    );

    return () => controller.abort();
  }, [initialCatalog, revision]);

  const retry = () => {
    setRequest({ status: "loading" });
    setRevision((current) => current + 1);
  };

  return {
    request: initialCatalog
      ? ({ status: "success", catalog: initialCatalog } as const)
      : request,
    retry,
  };
}
