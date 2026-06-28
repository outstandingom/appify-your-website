import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CoreFields from "./converter/CoreFields";
import FeatureToggles from "./converter/FeatureToggles";
import { DEFAULT_CONFIG, getTier, getCreditCost } from "./converter/types";
import type { BuildConfig, Step } from "./converter/types";

// Define types for the build response
interface BuildResponse {
  build_id: string;
  status?: string;
}

interface BuildStatus {
  status: string;
  error_message: string | null;
}

const ConverterForm = () => {
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("config");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = (p: Partial<BuildConfig>) => setConfig((c) => ({ ...c, ...p }));

  const isValid = config.websiteUrl.trim().length > 0 && config.appName.trim().length > 0;

  // Poll build status
  useEffect(() => {
    if (step === "generating" && buildId) {
      pollRef.current = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from("apk_builds")
            .select("status, error_message")
            .eq("id", buildId)
            .single();

          if (error) {
            console.error("Polling error:", error);
            return;
          }

          const build = data as BuildStatus;
          
          if (build?.status === "completed") {
            setStep("done");
            setIsGenerating(false);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (build?.status === "failed") {
            setStep("error");
            setIsGenerating(false);
            setErrorMsg(build.error_message || "Build failed");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000);
      
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [step, buildId]);

  const handleGenerate = async () => {
    if (!isValid || isGenerating) return;
    
    setIsGenerating(true);
    setStep("generating");
    setErrorMsg("");

    try {
      let websiteUrl = config.websiteUrl.trim();
      if (!websiteUrl.startsWith("http")) {
        websiteUrl = "https://" + websiteUrl;
      }

      const tier = getTier(config);

      // Log the request for debugging
      console.log("🚀 Sending build request:", {
        website_url: websiteUrl,
        app_name: config.appName.trim(),
        platform: config.platform,
        tier: tier,
      });

      // Prepare the request body with proper null handling
      const requestBody = {
        website_url: websiteUrl,
        app_name: config.appName.trim(),
        icon_url: config.logoPreview || null,
        package_name: config.packageName?.trim() || null,
        splash_color: config.splashColor || "#10B981",
        status_bar_color: config.statusBarColor || "#000000",
        enable_push: config.enablePush || false,
        enable_offline: config.enableOffline || false,
        offline_message: config.offlineMessage || "You are offline.",
        enable_analytics: config.enableAnalytics || false,
        enable_cookies: config.enableCookies !== undefined ? config.enableCookies : true,
        enable_admob: config.enableAdmob || false,
        admob_banner_id: config.admobBannerId || null,
        admob_interstitial_id: config.admobInterstitialId || null,
        build_aab: config.buildAab || false,
        platform: config.platform || "android",
        proxy_enabled: config.proxyEnabled || false,
        proxy_type: config.proxyType || null,
        proxy_host: config.proxyHost?.trim() || null,
        proxy_port: config.proxyPort ? parseInt(config.proxyPort, 10) : null,
        proxy_username: config.proxyUsername || null,
        proxy_password: config.proxyPassword || null,
        tier: tier || "free",
      };

      const { data, error } = await supabase.functions.invoke("trigger-build", {
        body: requestBody,
      });

      console.log("📦 Edge Function response:", { data, error });

      if (error) {
        console.error("❌ Function error:", error);
        throw new Error(error.message || "Function invocation failed");
      }
      
      if (data?.error) {
        console.error("❌ Data error:", data.error);
        throw new Error(data.error);
      }
      
      if (!data?.build_id) {
        console.error("❌ No build_id in response:", data);
        throw new Error("No build_id returned from server");
      }
      
      console.log("✅ Build started with ID:", data.build_id);
      setBuildId(data.build_id);
    } catch (err: any) {
      console.error("❌ Generation error:", err);
      setStep("error");
      setIsGenerating(false);
      setErrorMsg(err.message || "Failed to start build. Please try again.");
    }
  };

  const handleDownload = () => {
    if (!buildId) {
      setErrorMsg("No build ID available for download");
      return;
    }
    
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) {
      console.error("VITE_SUPABASE_PROJECT_ID is not set");
      setErrorMsg("Download configuration error. Please contact support.");
      return;
    }
    
    const downloadUrl = `https://${projectId}.supabase.co/functions/v1/download-apk?build_id=${buildId}`;
    console.log("📥 Download URL:", downloadUrl);
    window.open(downloadUrl, "_blank");
  };

  const handleReset = () => {
    setStep("config");
    setConfig({ ...DEFAULT_CONFIG });
    setBuildId(null);
    setErrorMsg("");
    setIsGenerating(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const tier = getTier(config);
  const cost = getCreditCost(tier);
  const outputLabel = config.platform === "ios" ? "IPA" : config.buildAab ? "AAB" : "APK";
  const platformLabel = config.platform === "ios" ? "iOS" : "Android";

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
            <div className="space-y-6 animate-fade-up" style={{ animationDelay: "0ms" }}>
              <CoreFields config={config} onChange={patch} />

              <div className="border-t border-border/40 pt-4">
                <FeatureToggles config={config} onChange={patch} />
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base gap-2"
                disabled={!isValid || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? "Starting build..." : `Generate ${outputLabel}`}
                {!isGenerating && cost > 0 && (
                  <span className="text-xs opacity-70 ml-1">({cost} credits)</span>
                )}
              </Button>
            </div>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse-glow">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-spin-slow" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold">Building your {outputLabel}...</p>
                <p className="text-sm text-muted-foreground">
                  Wrapping <span className="text-foreground font-medium">{config.appName}</span> for {platformLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 2–5 minutes. Don't close this page.
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center glow-ring">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold">Your {outputLabel} is ready!</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{config.appName}</span> has been generated
                </p>
                {buildId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Build ID: {buildId.substring(0, 8)}...
                  </p>
                )}
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full h-13 rounded-xl gap-2" 
                  onClick={handleDownload}
                >
                  <Download className="w-5 h-5" />
                  Download {outputLabel}
                </Button>
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Convert another website
                </Button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-fade-up" style={{ animationDelay: "0ms" }}>
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-lg font-semibold">Build failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button variant="default" onClick={handleReset} className="w-full">
                  Try again
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setStep("config");
                    setErrorMsg("");
                  }}
                  className="text-muted-foreground"
                >
                  Return to configuration
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
