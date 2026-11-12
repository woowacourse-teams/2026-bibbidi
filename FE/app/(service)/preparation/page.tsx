import { PreparationCatalogPage } from "../../../src/screens/PreparationCatalogPage";
import { readCatalogSnapshot } from "../../catalogSnapshot";
import { preparationMetadata } from "../../siteMetadata";

export const metadata = preparationMetadata;

export default function Page() {
  return <PreparationCatalogPage catalog={readCatalogSnapshot()} />;
}
