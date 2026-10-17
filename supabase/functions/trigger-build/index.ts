// supabase/functions/trigger-build/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { v4 as uuid } from "https://deno.land/std@0.168.0/uuid/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BuildRequest {
  website_url: string;
  app_name: string;
  package_name?: string;
  icon_url?: string;
  splash_color?: string;
  status_bar_color?: string;
  enable_push?: boolean;
  // ✅ ADDED — client-side Firebase config, baked into the APK by
  // orchestrator.py so the device can register with FCM. Without
  // forwarding this through to the workflow's inputs, FCM silently
  // never activates for any build, same failure mode callback_url
  // had before it was added here.
  google_services_json?: string;
  // ✅ ADDED — server-side Firebase Admin credential. Never embedded
  // in the APK; build.yml uses it once, right after the Android
  // project is generated, to register this app's Firebase project
  // with the push server, then discards it.
  firebase_service_account_json?: string;
  enable_offline?: boolean;
  offline_message?: string;
  enable_analytics?: boolean;
  enable_cookies?: boolean;
  enable_admob?: boolean;
  admob_banner_id?: string;
  admob_interstitial_id?: string;
  build_aab?: boolean;
  platform?: string; // "android" or "ios"
  tier?: string;
  proxy_enabled?: boolean;
  proxy_type?: string;
  proxy_host?: string;
  proxy_port?: string | number;
  proxy_username?: string;
  proxy_password?: string;
  build_id?: string; // optional
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Build request received");

    const body: BuildRequest = await req.json();
    const {
      website_url,
      app_name,
      package_name,
      icon_url,
      splash_color = "#10B981",
      status_bar_color = "#000000",
      enable_push = false,
      google_services_json,
      firebase_service_account_json,
      enable_offline = false,
      offline_message = "You are offline. Please check your connection.",
      enable_analytics = false,
      enable_cookies = true,
      enable_admob = false,
      admob_banner_id,
      admob_interstitial_id,
      build_aab = false,
      platform = "android",
      tier = "free",
      proxy_enabled = false,
      proxy_type = "http",
      proxy_host,
      proxy_port,
      proxy_username,
      proxy_password,
      build_id,
    } = body;

    // Validate required fields
    if (!website_url || !app_name) {
      return new Response(
        JSON.stringify({ error: "website_url and app_name are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate website_url is a valid URL
    try {
      new URL(website_url.startsWith("http") ? website_url : `https://${website_url}`);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid website_url format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate platform
    const validPlatforms = ["android", "ios"];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: "platform must be 'android' or 'ios'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate build_id if not provided
    const finalBuildId = build_id || uuid.generate();
    console.log("📦 Build ID:", finalBuildId);

    // GitHub token & repo
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubRepo = Deno.env.get("GITHUB_REPO"); // e.g., "owner/repo"

    if (!githubToken || !githubRepo) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN or GITHUB_REPO not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Build Queue Check ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Check if this build is already approved to start ('building' status)
      const { data: queueEntry } = await supabase
        .from('build_queue')
        .select('status')
        .eq('build_id', finalBuildId)
        .single();
        
      if (!queueEntry || queueEntry.status !== 'building') {
        // If not explicitly approved, check if we're under the limit
        const { data: activeCount } = await supabase.rpc('get_active_build_count');
        
        if (typeof activeCount === 'number' && activeCount >= 20) {
           return new Response(
             JSON.stringify({ 
               error: "Build queue is full (max 20). Please use the queue system.",
               status: "queued" 
             }),
             { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
           );
        }
      }
    }
    // -------------------------

    // Workflow filename (as it appears in .github/workflows/)
    const workflowId = "build.yml";
    const githubApi = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`;

    console.log("📡 Triggering workflow:", githubApi);

    // Map inputs exactly to the workflow's workflow_dispatch inputs
    // All values must be strings for GitHub API
    const inputs: Record<string, string> = {
      website_url: website_url,
      app_name: app_name,
      package_name: package_name || "",
      icon_url: icon_url || "",
      splash_color: splash_color,
      status_bar_color: status_bar_color,
      enable_push: String(enable_push),
      enable_offline: String(enable_offline),
      offline_message: offline_message,
      enable_analytics: String(enable_analytics),
      enable_cookies: String(enable_cookies),
      enable_admob: String(enable_admob),
      admob_banner_id: admob_banner_id || "",
      admob_interstitial_id: admob_interstitial_id || "",
      build_aab: String(build_aab),
      platform: platform.toLowerCase(),
      proxy_enabled: String(proxy_enabled),
      proxy_type: proxy_type,
      proxy_host: proxy_host || "",
      proxy_port: proxy_port ? String(proxy_port) : "",
      proxy_username: proxy_username || "",
      proxy_password: proxy_password || "",
      build_id: finalBuildId,
      callback_url: supabaseUrl ? `${supabaseUrl}/functions/v1/build-callback` : "",
    };

    const response = await fetch(githubApi, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main", // or the branch you want to use (e.g., "main")
        inputs,
      }),
    });

    console.log("📊 GitHub API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ GitHub API error:", errorText);
      let errorMessage = `GitHub API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage += `: ${errorText}`;
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ Build workflow triggered successfully");

    return new Response(
      JSON.stringify({
        status: "build_started",
        build_id: finalBuildId,
        platform: platform.toLowerCase(),
        message: "Build triggered successfully",
        details: {
          website_url,
          app_name,
          platform,
          tier,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("💥 Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
