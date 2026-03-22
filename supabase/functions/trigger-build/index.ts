import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const dataUrlToBytes = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid icon data format");
  }

  const [, mimeType, base64Data] = match;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { mimeType, bytes };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { website_url, app_name, icon_url } = await req.json();

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
        JSON.stringify({ error: "GITHUB_REPO is not configured (format: owner/repo)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let uploadedIconUrl: string | null = null;

    if (typeof icon_url === "string" && icon_url.startsWith("data:")) {
      const { mimeType, bytes } = dataUrlToBytes(icon_url);
      const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("svg") ? "svg" : "png";
      const iconPath = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("apk-icons")
        .upload(iconPath, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Icon upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from("apk-icons").getPublicUrl(iconPath);
      uploadedIconUrl = publicUrlData.publicUrl;
    } else if (typeof icon_url === "string" && icon_url.trim().length > 0) {
      uploadedIconUrl = icon_url;
    }

    const { data: build, error: dbError } = await supabase
      .from("apk_builds")
      .insert({
        website_url,
        app_name,
        icon_url: uploadedIconUrl,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    const callbackUrl = `${supabaseUrl}/functions/v1/build-callback`;

    const ghResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "build-apk",
        client_payload: {
          build_id: build.id,
          website_url,
          app_name,
          icon_url: uploadedIconUrl,
          callback_url: callbackUrl,
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
