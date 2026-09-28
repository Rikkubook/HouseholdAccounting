import axios, { AxiosError } from "axios";
import type { ApiError } from "@/types/models";

/** 後端為 Node（camelCase JSON），不做欄位轉換。 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

export const TOKEN_KEY = "family-ledger.token";

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (location.pathname !== "/login") location.replace("/login");
      return Promise.reject(normalizeError(error));
    }

    /**
     * 503（gateway_timeout）是後端偵測到資料庫連線疑似斷線、主動快速失敗、
     * 換新連線後回的——換好的新連線下一次請求就會正常，故自動重試一次，
     * 使用者幾乎感覺不到中間這次失敗。用 config 上的旗標避免無限重試。
     */
    const config = error.config as (typeof error.config & { _retried503?: boolean }) | undefined;
    if (error.response?.status === 503 && config && !config._retried503) {
      config._retried503 = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return http(config);
    }

    return Promise.reject(normalizeError(error));
  }
);

export function normalizeError(error: unknown): ApiError {
  const e = error as AxiosError<ApiError>;
  if (e.response?.data?.message) return e.response.data;
  return { code: "network_error", message: "連線失敗，請稍後再試" };
}

/** mock 模式下由 src/mocks 攔截；正式環境直接打真後端。 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
