import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Smartphone, Package, Upload, Link2, Image as ImageIcon } from "lucide-react";
import { useRef } from "react";
import type { BuildConfig } from "./types";

interface Props {
  config: BuildConfig;
  onChange: (patch: Partial<BuildConfig>) => void;
}

const CoreFields = ({ config, onChange }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        onChange({ logo: file, logoPreview: reader.result as string, iconUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const suggestPackageName = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return slug ? `com.app.${slug}` : "";
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="url" className="text-sm font-medium flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Website URL
        </Label>
        <Input
          id="url"
          type="url"
          placeholder="https://your-website.com"
          value={config.websiteUrl}
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
          className="h-11 bg-surface-sunken border-border/40 focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="appName" className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            App Name
          </Label>
          <Input
            id="appName"
            placeholder="My App"
            value={config.appName}
            onChange={(e) => {
              onChange({
                appName: e.target.value,
                packageName: config.packageName || suggestPackageName(e.target.value),
              });
            }}
            className="h-11 bg-surface-sunken border-border/40 focus:border-primary"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pkg" className="text-sm font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Package Name
          </Label>
          <Input
            id="pkg"
            placeholder="com.company.app"
            value={config.packageName}
            onChange={(e) => onChange({ packageName: e.target.value })}
            className="h-11 bg-surface-sunken border-border/40 focus:border-primary text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          App Icon & Splash Screen Image
          <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="https://example.com/logo.png"
              value={config.iconUrl || ""}
              onChange={(e) => onChange({ iconUrl: e.target.value, logoPreview: e.target.value })}
              className="h-11 pl-9 bg-surface-sunken border-border/40 focus:border-primary text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 h-11 rounded-lg border border-border/60 hover:border-primary/40 bg-surface-sunken flex items-center gap-2 text-xs font-medium hover:text-foreground text-muted-foreground transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={handleLogoChange}
        />

        {config.logoPreview && (
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
            <img
              src={config.logoPreview}
              alt="Icon Preview"
              className="w-12 h-12 rounded-xl object-cover shadow-sm bg-background border"
              onError={(e) => {
                // If invalid URL, hide broken image
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="text-xs space-y-0.5 overflow-hidden">
              <p className="font-medium text-foreground truncate">Selected Icon & Splash Image</p>
              <p className="text-[11px] text-muted-foreground truncate">{config.iconUrl || "Local file selected"}</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ logo: null, logoPreview: null, iconUrl: "" })}
              className="ml-auto text-xs text-muted-foreground hover:text-destructive px-2 py-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoreFields;
