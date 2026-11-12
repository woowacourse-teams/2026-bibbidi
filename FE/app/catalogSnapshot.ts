import { readFileSync } from "node:fs";
import type { CatalogModel } from "../src/features/catalog";

export function readCatalogSnapshot(): CatalogModel {
  const snapshotPath = process.env.BIBBIDI_CATALOG_SNAPSHOT_PATH;
  if (!snapshotPath) {
    throw new Error(
      "pnpm dev 또는 pnpm build로 공개 카탈로그를 준비해 주세요.",
    );
  }
  const { catalog } = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
    catalog: CatalogModel;
  };
  return catalog;
}
