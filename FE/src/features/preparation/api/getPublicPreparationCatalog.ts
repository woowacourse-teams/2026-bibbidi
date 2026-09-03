import { PreparationCatalogModel } from "../model/preparationRoadmap";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const PUBLIC_CATALOG_ENDPOINT = `${apiBaseUrl}/api/catalog/public`;
const PUBLIC_CATALOG_TIMEOUT_MS = 10_000;

export class PublicPreparationCatalogApiError extends Error {
  constructor(readonly status: number) {
    super("준비 목록을 불러오지 못했습니다.");
    this.name = "PublicPreparationCatalogApiError";
  }
}

export class PublicPreparationCatalogNetworkError extends Error {
  constructor() {
    super("준비 목록 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "PublicPreparationCatalogNetworkError";
  }
}

export class PublicPreparationCatalogTimeoutError extends Error {
  constructor() {
    super("준비 목록 요청 시간이 초과됐습니다.");
    this.name = "PublicPreparationCatalogTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getPublicPreparationCatalog(): Promise<PreparationCatalogModel> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PUBLIC_CATALOG_TIMEOUT_MS,
  );

  try {
    response = await fetch(PUBLIC_CATALOG_ENDPOINT, {
      method: "GET",
      signal: controller.signal,
    });
  } catch (error) {
    if (isRecord(error) && error.name === "AbortError") {
      throw new PublicPreparationCatalogTimeoutError();
    }

    throw new PublicPreparationCatalogNetworkError();
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new PublicPreparationCatalogApiError(response.status);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error("준비 목록 성공 응답을 해석하지 못했습니다.");
  }

  return parsePreparationCatalogResponse(body);
}
