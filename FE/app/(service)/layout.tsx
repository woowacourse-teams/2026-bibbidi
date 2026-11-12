import type { ReactNode } from "react";
import { ServiceLayout } from "../../src/layouts/ServiceLayout";
import { readCatalogSnapshot } from "../catalogSnapshot";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ServiceLayout catalogCategories={readCatalogSnapshot().categories}>
      {children}
    </ServiceLayout>
  );
}
