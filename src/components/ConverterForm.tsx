import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Upload, Smartphone, Loader2, Download, CheckCircle2 } from "lucide-react";

type Step = "input" | "generating" | "done";

const ConverterForm = () => {
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("input");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const isValid = url.trim().length > 0 && appName.trim().length > 0;

  const handleGenerate = () => {
    if (!isValid) return;
    setStep("generating");
    // Simulate APK generation
    setTimeout(() => setStep("done"), 3500);
  };

  const handleReset = () => {
    setStep("input");
    setUrl("");
    setAppName("");
    setLogo(null);
    setLogoPreview(null);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/60 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{
              width: step === "input" ? "33%" : step === "generating" ? "66%" : "100%",
            }}
          />
        </div>

        <div className="p-8 space-y-6">
          {step === "input" && (
            <div className="space-y-5 animate-fade-up" style={{ opacity: 0 }}>
              <div className="space-y-2">
                <Label htmlFor="url" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Website URL
                </Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://your-website.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-12 text-base bg-surface-sunken border-border/40 focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appName" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  App Name
                </Label>
                <Input
                  id="appName"
                  placeholder="My Awesome App"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="h-12 text-base bg-surface-sunken border-border/40 focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  App Icon
                  <span className="text-muted-foreground font-normal">(optional)</span>
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
                  className="w-full h-28 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 bg-surface-sunken flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover shadow-md" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        Click to upload PNG, JPG or SVG
                      </span>
                    </>
                  )}
                </button>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base"
                disabled={!isValid}
                onClick={handleGenerate}
              >
                Generate APK
              </Button>
            </div>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-fade-up" style={{ opacity: 0 }}>
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse-glow">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-spin-slow" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold text-foreground">Building your APK...</p>
                <p className="text-sm text-muted-foreground">
                  Wrapping <span className="text-foreground font-medium">{appName}</span> for Android
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-fade-up" style={{ opacity: 0 }}>
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center glow-ring">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold text-foreground">Your APK is ready!</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{appName}</span> has been generated
                </p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button variant="hero" size="lg" className="w-full h-13 rounded-xl gap-2">
                  <Download className="w-5 h-5" />
                  Download APK
                </Button>
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Convert another website
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConverterForm;
