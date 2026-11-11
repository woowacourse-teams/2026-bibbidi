"use client";

import type { ReactNode } from "react";
import { ServiceLayout } from "../../src/layouts/ServiceLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <ServiceLayout showNavigationDock={false}>{children}</ServiceLayout>;
}
