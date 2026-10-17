import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell, WifiOff, Palette, BarChart3, Cookie,
  DollarSign, FileArchive, Smartphone, Apple,
  UploadCloud, CheckCircle2, AlertTriangle
} from "lucide-react";
import type { BuildConfig, Tier } from "./types";
import { getTier, getCreditCost } from "./types";
import ProxySettings from "./ProxySettings";

interface Props {
  config: BuildConfig;
  onChange: (patch: Partial<BuildConfig>) => void;
}

const tierBadge = (tier: "premium" | "pro") => (
  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tier === "pro" ? "border-amber-500/40 text-amber-600" : "border-primary/40 text-primary"}`}>
    {tier.toUpperCase()}
  </Badge>
);

// Reads a JSON file from a <input type="file"> event and hands its
// raw text content back via onLoaded. Each converted app needs its
// OWN Firebase project — these files are never shared across builds,
// which is why we collect them per-build instead of hardcoding one
// credential on the server.
function readJsonFile(file: File, onLoaded: (text: string) => void, onError: (msg: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    try {
      JSON.parse(text); // validate it's actually JSON before accepting
      onLoaded(text);
    } catch {
      onError("That file doesn't look like valid JSON — please re-download it from Firebase.");
    }
  };
  reader.onerror = () => onError("Could not read that file.");
  reader.readAsText(file);
}

function FirebaseFileField({
  label,
  helpText,
  value,
  onFile,
}: {
  label: string;
  helpText: string;
  value: string;
  onFile: (text: string) => void;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className="space-y-1.5 ml-8">
      <Label className="text-xs flex items-center gap-1.5">
        {label}
        {hasValue && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
      </Label>
      <label
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
          hasValue
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border bg-surface-sunken text-muted-foreground hover:text-foreground"
        }`}
      >
        <UploadCloud className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{hasValue ? "File loaded — click to replace" : "Click to upload .json file"}</span>
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            readJsonFile(file, onFile, (msg) => alert(msg));
            e.target.value = ""; // allow re-selecting the same file name later
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{helpText}</p>
    </div>
  );
}

const FeatureToggles = ({ config, onChange }: Props) => {
  const currentTier = getTier(config);
  const cost = getCreditCost(currentTier);

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Platform</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ platform: "android", buildAab: config.platform === "ios" ? false : config.buildAab })}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              config.platform === "android"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface-sunken text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="w-4 h-4" /> Android
          </button>
          <button
            type="button"
            onClick={() => onChange({ platform: "ios", buildAab: false })}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              config.platform === "ios"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface-sunken text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="w-4 h-4" /> iOS
          </button>
        </div>
        {config.platform === "ios" && (
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            iOS builds produce an <span className="font-medium text-foreground">unsigned .ipa</span> (works in simulators, not directly installable on real iPhones without signing).
          </p>
        )}
      </div>

      {/* Tier indicator */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-sunken">
        <span className="text-xs font-medium text-muted-foreground">Build tier</span>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${currentTier === "pro" ? "bg-amber-500" : currentTier === "premium" ? "bg-primary" : "bg-muted text-muted-foreground"}`}>
            {currentTier.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {cost === 0 ? "Free" : `${cost} credits`}
          </span>
        </div>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Theme</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Splash Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.splashColor}
                onChange={(e) => onChange({ splashColor: e.target.value })}
                className="w-8 h-8 rounded-md border border-border cursor-pointer"
              />
              <Input
                value={config.splashColor}
                onChange={(e) => onChange({ splashColor: e.target.value })}
                className="h-8 text-xs bg-surface-sunken"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Status Bar {tierBadge("premium")}
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.statusBarColor}
                onChange={(e) => onChange({ statusBarColor: e.target.value })}
                className="w-8 h-8 rounded-md border border-border cursor-pointer"
              />
              <Input
                value={config.statusBarColor}
                onChange={(e) => onChange({ statusBarColor: e.target.value })}
                className="h-8 text-xs bg-surface-sunken"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Premium features */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Premium Features</p>
        <div className="space-y-2">
          <ToggleRow
            icon={<Bell className="w-4 h-4" />}
            label="Push Notifications"
            badge={tierBadge("premium")}
            checked={config.enablePush}
            onToggle={(v) => onChange({ enablePush: v })}
          />
          {config.enablePush && (
            <div className="space-y-3 py-2">
              <div className="ml-8 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Push requires your own free Firebase project (one per app — this is
                  the same way every push-notification service works, browser or app).
                  Create one at{" "}
                  <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-medium">
                    console.firebase.google.com
                  </a>, then upload the two files below.
                </p>
              </div>

              <FirebaseFileField
                label="google-services.json"
                helpText="Project Settings → General → Your apps → download google-services.json. Gets baked into the app."
                value={config.googleServicesJson}
                onFile={(text) => onChange({ googleServicesJson: text })}
              />

              <FirebaseFileField
                label="Firebase service account key"
                helpText="Project Settings → Service accounts → Generate new private key. Used only to register your app with the push server — never stored in the APK."
                value={config.firebaseServiceAccountJson}
                onFile={(text) => onChange({ firebaseServiceAccountJson: text })}
              />
            </div>
          )}
          <ToggleRow
            icon={<WifiOff className="w-4 h-4" />}
            label="Offline Fallback"
            badge={tierBadge("premium")}
            checked={config.enableOffline}
            onToggle={(v) => onChange({ enableOffline: v })}
          />
          {config.enableOffline && (
            <Input
              placeholder="Offline message..."
              value={config.offlineMessage}
              onChange={(e) => onChange({ offlineMessage: e.target.value })}
              className="h-8 text-xs bg-surface-sunken ml-8"
            />
          )}
          <ToggleRow
            icon={<BarChart3 className="w-4 h-4" />}
            label="Analytics"
            badge={tierBadge("premium")}
            checked={config.enableAnalytics}
            onToggle={(v) => onChange({ enableAnalytics: v })}
          />
          <ToggleRow
            icon={<Cookie className="w-4 h-4" />}
            label="Login Support (Cookies)"
            checked={config.enableCookies}
            onToggle={(v) => onChange({ enableCookies: v })}
          />
        </div>
      </div>

      {/* Pro features */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pro Features</p>
        <div className="space-y-2">
          <ToggleRow
            icon={<DollarSign className="w-4 h-4" />}
            label="AdMob Integration"
            badge={tierBadge("pro")}
            checked={config.enableAdmob}
            onToggle={(v) => onChange({ enableAdmob: v })}
          />
          {config.enableAdmob && (
            <div className="ml-8 space-y-2">
              <Input
                placeholder="Banner Ad Unit ID (ca-app-pub-xxx)"
                value={config.admobBannerId}
                onChange={(e) => onChange({ admobBannerId: e.target.value })}
                className="h-8 text-xs bg-surface-sunken"
              />
              <Input
                placeholder="Interstitial Ad Unit ID (optional)"
                value={config.admobInterstitialId}
                onChange={(e) => onChange({ admobInterstitialId: e.target.value })}
                className="h-8 text-xs bg-surface-sunken"
              />
            </div>
          )}
          {config.platform === "android" && (
            <ToggleRow
              icon={<FileArchive className="w-4 h-4" />}
              label="Play Store Bundle (AAB)"
              badge={tierBadge("pro")}
              checked={config.buildAab}
              onToggle={(v) => onChange({ buildAab: v })}
            />
          )}
          <ProxySettings config={config} onChange={onChange} />
        </div>
      </div>
    </div>
  );
};

function ToggleRow({
  icon,
  label,
  badge,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  checked: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-sunken/50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        {badge}
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

export default FeatureToggles;
