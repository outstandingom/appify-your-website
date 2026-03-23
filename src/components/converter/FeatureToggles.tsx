import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell, WifiOff, Palette, BarChart3, Cookie,
  DollarSign, FileArchive
} from "lucide-react";
import type { BuildConfig, Tier } from "./types";
import { getTier, getCreditCost } from "./types";

interface Props {
  config: BuildConfig;
  onChange: (patch: Partial<BuildConfig>) => void;
}

const tierBadge = (tier: "premium" | "pro") => (
  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tier === "pro" ? "border-amber-500/40 text-amber-600" : "border-primary/40 text-primary"}`}>
    {tier.toUpperCase()}
  </Badge>
);

const FeatureToggles = ({ config, onChange }: Props) => {
  const currentTier = getTier(config);
  const cost = getCreditCost(currentTier);

  return (
    <div className="space-y-4">
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
          <ToggleRow
            icon={<FileArchive className="w-4 h-4" />}
            label="Play Store Bundle (AAB)"
            badge={tierBadge("pro")}
            checked={config.buildAab}
            onToggle={(v) => onChange({ buildAab: v })}
          />
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
