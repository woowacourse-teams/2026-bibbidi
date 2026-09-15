import { remoteCatalogDataSource } from "../../catalog/data-source/remoteCatalogDataSource";
import { createPreparationCatalogModel } from "../model/preparationRoadmap";

export {
  RemoteCatalogApiError as RemotePreparationCatalogApiError,
  RemoteCatalogNetworkError as RemotePreparationCatalogNetworkError,
  RemoteCatalogRequestAbortedError as RemotePreparationCatalogRequestAbortedError,
  RemoteCatalogTimeoutError as RemotePreparationCatalogTimeoutError,
} from "../../catalog/data-source/remoteCatalogDataSource";

export const remotePreparationCatalogDataSource = {
  async getCatalog(signal?: AbortSignal) {
    const catalog = await remoteCatalogDataSource.getCatalog(signal);

    return createPreparationCatalogModel(catalog);
  },
};
