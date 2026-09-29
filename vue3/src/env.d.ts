/// <reference types="vite/client" />

/** 由 vite.config.ts 的 define 注入，取自 package.json 的 version 欄位。 */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
