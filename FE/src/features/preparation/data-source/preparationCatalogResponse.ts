import { parseCatalogResponse } from "../../catalog/data-source/catalogResponse";
import {
  createPreparationCatalogModel,
  PreparationCatalogModel,
} from "../model/preparationRoadmap";

export function parsePreparationCatalogResponse(
  value: unknown,
): PreparationCatalogModel {
  return createPreparationCatalogModel(parseCatalogResponse(value));
}
