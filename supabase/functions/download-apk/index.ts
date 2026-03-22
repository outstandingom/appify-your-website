import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const buildId = url.searchParams.get("build_id");

    if (!buildId) {
      return new Response(
        JSON.stringify({ error: "build_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
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

    // Get build info
    const { data: build, error } = await supabase
      .from("apk_builds")
      .select("*")
      .eq("id", buildId)
      .single();

    if (error || !build) {
      return new Response(
        JSON.stringify({ error: "Build not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (build.status !== "completed") {
      return new Response(
        JSON.stringify({ error: "Build not completed yet", status: build.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the artifact from GitHub
    const artifactName = `apk-${buildId}`;
    const artifactsResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?name=${artifactName}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!artifactsResp.ok) {
      const errText = await artifactsResp.text();
      throw new Error(`GitHub artifacts API error [${artifactsResp.status}]: ${errText}`);
    }

    const artifactsData = await artifactsResp.json();
    const artifact = artifactsData.artifacts?.[0];

    if (!artifact) {
      return new Response(
        JSON.stringify({ error: "APK artifact not found on GitHub" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the download URL
    const downloadResp = await fetch(artifact.archive_download_url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      redirect: "follow",
    });

    if (!downloadResp.ok) {
      throw new Error(`Failed to download artifact [${downloadResp.status}]`);
    }

    const apkData = await downloadResp.arrayBuffer();

    return new Response(apkData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${build.app_name}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
