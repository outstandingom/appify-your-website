export type Platform = "android" | "ios";
export type ProxyType = "http" | "socks5";

export interface BuildConfig {
  // Platform
  platform: Platform;

  // Core
  websiteUrl: string;
  appName: string;
  packageName: string;
  logo: File | null;
  logoPreview: string | null;

  // Theme
  splashColor: string;
  statusBarColor: string;

  // Premium
  enablePush: boolean;
  enableOffline: boolean;
  offlineMessage: string;
  enableAnalytics: boolean;
  enableCookies: boolean;

  // Pro
  enableAdmob: boolean;
  admobBannerId: string;
  admobInterstitialId: string;
  buildAab: boolean;

  // Pro – Proxy / Custom IP
  proxyEnabled: boolean;
  proxyType: ProxyType;
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
}

export type Step = "config" | "generating" | "done" | "error";

export type Tier = "free" | "premium" | "pro";

export const DEFAULT_CONFIG: BuildConfig = {
  platform: "android",
  websiteUrl: "",
  appName: "",
  packageName: "",
  logo: null,
  logoPreview: null,
  splashColor: "#10B981",
  statusBarColor: "#000000",
  enablePush: false,
  enableOffline: false,
  offlineMessage: "You are offline. Please check your connection.",
  enableAnalytics: false,
  enableCookies: true,
  enableAdmob: false,
  admobBannerId: "",
  admobInterstitialId: "",
  buildAab: false,
  proxyEnabled: false,
  proxyType: "http",
  proxyHost: "",
  proxyPort: "",
  proxyUsername: "",
  proxyPassword: "",
};

export function getTier(config: BuildConfig): Tier {
  if (config.enableAdmob || config.buildAab || config.proxyEnabled) return "pro";
  if (
    config.platform === "ios" ||
    config.enablePush ||
    config.enableOffline ||
    config.enableAnalytics ||
    config.statusBarColor !== "#000000"
  ) return "premium";
  return "free";
}

export function getCreditCost(tier: Tier): number {
  switch (tier) {
    case "free": return 0;
    case "premium": return 5;
    case "pro": return 15;
  }
}
