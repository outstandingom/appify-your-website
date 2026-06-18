import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe2, Info } from "lucide-react";
import type { BuildConfig, ProxyType } from "./types";

interface Props {
  config: BuildConfig;
  onChange: (patch: Partial<BuildConfig>) => void;
}

const ProxySettings = ({ config, onChange }: Props) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-sunken/50 transition-colors">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Custom IP / Proxy</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600">
            PRO
          </Badge>
        </div>
        <Switch
          checked={config.proxyEnabled}
          onCheckedChange={(v) => onChange({ proxyEnabled: v })}
        />
      </div>

      {config.proxyEnabled && (
        <div className="ml-3 space-y-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.03]">
          <p className="text-[11px] text-muted-foreground leading-relaxed flex gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              All traffic from the generated app will route through this proxy, so the target site sees the proxy's IP — useful for agencies managing multiple social accounts. You need a working HTTP or SOCKS5 proxy from your provider.
            </span>
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select
                value={config.proxyType}
                onChange={(e) => onChange({ proxyType: e.target.value as ProxyType })}
                className="h-9 w-full rounded-md border border-border/40 bg-surface-sunken px-2 text-xs focus:border-primary outline-none"
              >
                <option value="http">HTTP/HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Host / IP</Label>
              <Input
                placeholder="123.45.67.89"
                value={config.proxyHost}
                onChange={(e) => onChange({ proxyHost: e.target.value })}
                className="h-9 text-xs bg-surface-sunken"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Port</Label>
            <Input
              type="number"
              placeholder="8080"
              value={config.proxyPort}
              onChange={(e) => onChange({ proxyPort: e.target.value })}
              className="h-9 text-xs bg-surface-sunken"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Username (optional)</Label>
              <Input
                placeholder="user"
                value={config.proxyUsername}
                onChange={(e) => onChange({ proxyUsername: e.target.value })}
                className="h-9 text-xs bg-surface-sunken"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password (optional)</Label>
              <Input
                type="password"
                placeholder="••••••"
                value={config.proxyPassword}
                onChange={(e) => onChange({ proxyPassword: e.target.value })}
                className="h-9 text-xs bg-surface-sunken"
                autoComplete="off"
              />
            </div>
          </div>

          {config.platform === "ios" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
              iOS proxy support requires iOS 17+ on the user's device. Older iOS versions will ignore this setting.
            </p>
          )}
          {config.platform === "android" && config.proxyType === "socks5" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
              Android WebView natively supports only HTTP/HTTPS proxies. SOCKS5 will be tunneled through a local HTTP bridge — use HTTP/HTTPS proxy when possible for best reliability.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProxySettings;
