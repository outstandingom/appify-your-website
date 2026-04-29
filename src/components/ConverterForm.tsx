import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CoreFields from "./converter/CoreFields";
import FeatureToggles from "./converter/FeatureToggles";
import { DEFAULT_CONFIG, getTier, getCreditCost } from "./converter/types";
import type { BuildConfig, Step } from "./converter/types";

const ConverterForm = () => {
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("config");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = (p: Partial<BuildConfig>) => setConfig((c) => ({ ...c, ...p }));

  const isValid = config.websiteUrl.trim().length > 0 && config.appName.trim().length > 0;

  // Poll build status
  useEffect(() => {
    if (step === "generating" && buildId) {
      pollRef.current = setInterval(async () => {
        const { data } = await (supabase as any)
          .from("apk_builds")
          .select("status, error_message")
          .eq("id", buildId)
          .single();

        const build = data as { status: string; error_message: string | null } | null;
        if (build?.status === "completed") {
          setStep("done");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (build?.status === "failed") {
          setStep("error");
          setErrorMsg(build.error_message || "Build failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [step, buildId]);

  const handleGenerate = async () => {
    if (!isValid) return;
    setStep("generating");
    setErrorMsg("");

    try {
      let websiteUrl = config.websiteUrl.trim();
      if (!websiteUrl.startsWith("http")) websiteUrl = "https://" + websiteUrl;

      const tier = getTier(config);

      const { data, error } = await supabase.functions.invoke("trigger-build", {
        body: {
          website_url: websiteUrl,
          app_name: config.appName.trim(),
          icon_url: config.logoPreview || null,
          package_name: config.packageName.trim() || null,
          splash_color: config.splashColor,
          status_bar_color: config.statusBarColor,
          enable_push: config.enablePush,
          enable_offline: config.enableOffline,
          offline_message: config.offlineMessage,
          enable_analytics: config.enableAnalytics,
          enable_cookies: config.enableCookies,
          enable_admob: config.enableAdmob,
          admob_banner_id: config.admobBannerId || null,
          admob_interstitial_id: config.admobInterstitialId || null,
          build_aab: config.buildAab,
          platform: config.platform,
          tier,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setBuildId(data.build_id);
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message || "Failed to start build");
    }
  };

  const handleDownload = () => {
    if (!buildId) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    window.open(
      `https://${projectId}.supabase.co/functions/v1/download-apk?build_id=${buildId}`,
      "_blank"
    );
  };

  const handleReset = () => {
    setStep("config");
    setConfig({ ...DEFAULT_CONFIG });
    setBuildId(null);
    setErrorMsg("");
  };

  const tier = getTier(config);
  const cost = getCreditCost(tier);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/60 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{
              width: step === "config" ? "33%" : step === "generating" ? "66%" : "100%",
            }}
          />
        </div>

        <div className="p-6 md:p-8">
          {step === "config" && (
            <div className="space-y-6 animate-fade-up" style={{ opacity: 0 }}>
              <CoreFields config={config} onChange={patch} />

              <div className="border-t border-border/40 pt-4">
                <FeatureToggles config={config} onChange={patch} />
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base gap-2"
                disabled={!isValid}
                onClick={handleGenerate}
              >
                <Sparkles className="w-4 h-4" />
                Generate {config.buildAab ? "AAB" : "APK"}
                {cost > 0 && (
                  <span className="text-xs opacity-70 ml-1">({cost} credits)</span>
                )}
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
                <p className="font-display text-lg font-semibold">Building your {config.buildAab ? "AAB" : "APK"}...</p>
                <p className="text-sm text-muted-foreground">
                  Wrapping <span className="text-foreground font-medium">{config.appName}</span> for Android
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 2–5 minutes. Don't close this page.
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
                <p className="font-display text-lg font-semibold">Your {config.buildAab ? "AAB" : "APK"} is ready!</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{config.appName}</span> has been generated
                </p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button variant="hero" size="lg" className="w-full h-13 rounded-xl gap-2" onClick={handleDownload}>
                  <Download className="w-5 h-5" />
                  Download {config.buildAab ? "AAB" : "APK"}
                </Button>
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Convert another website
                </Button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-fade-up" style={{ opacity: 0 }}>
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold">Build failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConverterForm;
