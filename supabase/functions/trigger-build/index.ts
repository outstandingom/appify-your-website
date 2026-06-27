import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://www.growhaz.com",
  "https://growhaz.com",
  "https://www.growhaz.in",
  "https://growhaz.in",
];

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const host = (() => { try { return new URL(origin).hostname; } catch { return ""; } })();
  // Allow growhaz.com / growhaz.in (with or without www) and Lovable preview subdomains
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://www.growhaz.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "_allowed": isAllowed ? "1" : "0",
  } as Record<string, string>;
};

const dataUrlToBytes = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error("Invalid icon data format");
  const [, mimeType, base64Data] = match;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mimeType, bytes };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      website_url, app_name, icon_url,
      package_name, splash_color, status_bar_color,
      enable_push, enable_offline, offline_message,
      enable_analytics, enable_cookies,
      enable_admob, admob_banner_id, admob_interstitial_id,
      build_aab, tier, platform,
      proxy_enabled, proxy_type, proxy_host, proxy_port,
      proxy_username, proxy_password,
    } = body;

    const targetPlatform = platform === "ios" ? "ios" : "android";

    if (!website_url || !app_name) {
      return new Response(
        JSON.stringify({ error: "website_url and app_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GITHUB_REPO = Deno.env.get("GITHUB_REPO");
    if (!GITHUB_REPO) {
      return new Response(
        JSON.stringify({ error: "GITHUB_REPO not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload icon if base64
    let uploadedIconUrl: string | null = null;
    if (typeof icon_url === "string" && icon_url.startsWith("data:")) {
      const { mimeType, bytes } = dataUrlToBytes(icon_url);
      const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("svg") ? "svg" : "png";
      const iconPath = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("apk-icons")
        .upload(iconPath, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) throw new Error(`Icon upload failed: ${uploadError.message}`);
      const { data: publicUrlData } = supabase.storage.from("apk-icons").getPublicUrl(iconPath);
      uploadedIconUrl = publicUrlData.publicUrl;
    } else if (typeof icon_url === "string" && icon_url.trim().length > 0) {
      uploadedIconUrl = icon_url;
    }

    // Insert build record
    const { data: build, error: dbError } = await supabase
      .from("apk_builds")
      .insert({
        website_url,
        app_name,
        icon_url: uploadedIconUrl,
        package_name: package_name || null,
        splash_color: splash_color || "#10B981",
        status_bar_color: status_bar_color || "#000000",
        enable_push: enable_push || false,
        enable_offline: enable_offline || false,
        offline_message: offline_message || "You are offline.",
        enable_analytics: enable_analytics || false,
        enable_cookies: enable_cookies !== false,
        enable_admob: enable_admob || false,
        admob_banner_id: admob_banner_id || null,
        admob_interstitial_id: admob_interstitial_id || null,
        build_aab: build_aab || false,
        platform: targetPlatform,
        tier: tier || "free",
        status: "pending",
        proxy_enabled: !!proxy_enabled,
        proxy_type: proxy_enabled ? (proxy_type || "http") : null,
        proxy_host: proxy_enabled ? (proxy_host || null) : null,
        proxy_port: proxy_enabled && proxy_port ? Number(proxy_port) : null,
        proxy_username: proxy_enabled ? (proxy_username || null) : null,
        proxy_password: proxy_enabled ? (proxy_password || null) : null,
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    // Artifact is stored on GitHub Actions and streamed directly to the user
    // by the download-apk edge function. No cloud storage upload needed.
    const callbackUrl = `${supabaseUrl}/functions/v1/build-callback`;

    const ghResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: targetPlatform === "ios" ? "build-ipa" : "build-apk",
        client_payload: {
          build_id: build.id,
          callback_url: callbackUrl,
          config: JSON.stringify({
            website_url,
            app_name,
            icon_url: uploadedIconUrl,
            package_name: package_name || null,
            splash_color: splash_color || "#10B981",
            status_bar_color: status_bar_color || "#000000",
            enable_push: enable_push || false,
            enable_offline: enable_offline || false,
            offline_message: offline_message || "You are offline.",
            enable_analytics: enable_analytics || false,
            enable_cookies: enable_cookies !== false,
            enable_admob: enable_admob || false,
            admob_banner_id: admob_banner_id || null,
            admob_interstitial_id: admob_interstitial_id || null,
            build_aab: build_aab || false,
            platform: targetPlatform,
            proxy_enabled: !!proxy_enabled,
            proxy_type: proxy_enabled ? (proxy_type || "http") : null,
            proxy_host: proxy_enabled ? (proxy_host || null) : null,
            proxy_port: proxy_enabled && proxy_port ? Number(proxy_port) : null,
            proxy_username: proxy_enabled ? (proxy_username || null) : null,
            proxy_password: proxy_enabled ? (proxy_password || null) : null,
          }),
        },
      }),
    });

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      throw new Error(`GitHub API error [${ghResponse.status}]: ${errText}`);
    }

    await supabase
      .from("apk_builds")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("id", build.id);

    return new Response(
      JSON.stringify({ build_id: build.id, status: "building" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
