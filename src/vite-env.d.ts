/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_AUTH_BRIDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AndroidAuthBridgeApi {
  openExternalBrowser: (url: string) => void;
  consumePendingAuthUrl: () => string;
}

interface Window {
  AndroidAuthBridge?: AndroidAuthBridgeApi;
  __EROT_SW_OFFLINE_READY__?: boolean;
}

declare const __APP_VERSION__: string;
declare const __APK_VERSION_CODE__: number;

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
