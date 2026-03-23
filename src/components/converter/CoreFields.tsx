import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Smartphone, Package, Upload } from "lucide-react";
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
        onChange({ logo: file, logoPreview: reader.result as string });
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

      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          App Icon
          <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={handleLogoChange}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-20 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 bg-surface-sunken flex items-center justify-center gap-3 transition-colors cursor-pointer group"
        >
          {config.logoPreview ? (
            <img src={config.logoPreview} alt="Icon" className="w-12 h-12 rounded-xl object-cover shadow-md" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Upload PNG, JPG or SVG
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CoreFields;
