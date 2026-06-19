// v2: stream from Lovable Cloud storage
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const artifactPath: string | null = build.artifact_path;
    if (!artifactPath) {
      return new Response(
        JSON.stringify({ error: "Artifact not uploaded yet" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the file from private bucket and stream it back to the user.
    const { data: file, error: dlErr } = await supabase
      .storage
      .from("apk-builds")
      .download(artifactPath);

    if (dlErr || !file) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch artifact: ${dlErr?.message || "unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ext = artifactPath.split(".").pop() || "bin";
    const contentType =
      ext === "apk" ? "application/vnd.android.package-archive" :
      ext === "aab" ? "application/octet-stream" :
      ext === "ipa" ? "application/octet-stream" :
      "application/octet-stream";

    const safeName = String(build.app_name || "app").replace(/[^a-z0-9-_]+/gi, "_");

    return new Response(file.stream(), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}.${ext}"`,
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
