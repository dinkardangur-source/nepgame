/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __APK_VERSION_CODE__: number;

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
