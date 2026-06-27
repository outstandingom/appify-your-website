// v3: stream artifact directly from GitHub Actions (no cloud storage)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const ALLOWED_HOSTS = [
  "www.growhaz.com",
  "growhaz.com",
  "www.growhaz.in",
  "growhaz.in",
];

const isAllowedHost = (host: string) =>
  ALLOWED_HOSTS.includes(host) ||
  host.endsWith(".lovable.app") ||
  host.endsWith(".lovableproject.com");

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  let originHost = "";
  try { originHost = new URL(origin).hostname; } catch {}
  const allow = origin && isAllowedHost(originHost) ? origin : "https://www.growhaz.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
  } as Record<string, string>;
};

Deno.serve(async (req) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Gate access by Origin (XHR/fetch) OR Referer (direct browser nav from window.open)
  // OR a valid server-to-server API key.
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer") || "";
  let refHost = "";
  try { refHost = new URL(referer).hostname; } catch {}
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("PUBLIC_API_KEY");

  const originOk = origin ? isAllowedHost(new URL(origin).hostname) : false;
  const refererOk = refHost ? isAllowedHost(refHost) : false;
  const apiOk = expectedKey && apiKey === expectedKey;

  if (!originOk && !refererOk && !apiOk) {
    return new Response(
      JSON.stringify({ error: "Forbidden. API restricted to growhaz.com / growhaz.in" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    );
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

    const runId = build.github_run_id;
    if (!runId) {
      return new Response(
        JSON.stringify({ error: "Build run id missing" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
    const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;
    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    };

    // List artifacts for the run
    const listRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/artifacts`,
      { headers: ghHeaders }
    );
    if (!listRes.ok) {
      const t = await listRes.text();
      throw new Error(`GitHub artifact list failed [${listRes.status}]: ${t}`);
    }
    const listJson = await listRes.json();
    const wanted = `app-build-${buildId}`;
    const artifact =
      listJson.artifacts?.find((a: any) => a.name === wanted) ||
      listJson.artifacts?.[0];
    if (!artifact) {
      return new Response(
        JSON.stringify({ error: "No artifact attached to build run" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the artifact zip
    const dlRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`,
      { headers: ghHeaders, redirect: "follow" }
    );
    if (!dlRes.ok) {
      const t = await dlRes.text();
      throw new Error(`GitHub artifact download failed [${dlRes.status}]: ${t}`);
    }
    const zipBytes = new Uint8Array(await dlRes.arrayBuffer());
    const entries = unzipSync(zipBytes);

    // Pick the apk/aab/ipa inside the zip
    const preferredExt =
      build.platform === "ios" ? "ipa" : build.build_aab ? "aab" : "apk";
    let chosenName: string | null = null;
    let chosenBytes: Uint8Array | null = null;
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.toLowerCase().endsWith(`.${preferredExt}`)) {
        chosenName = name;
        chosenBytes = bytes as Uint8Array;
        break;
      }
    }
    if (!chosenBytes) {
      for (const [name, bytes] of Object.entries(entries)) {
        if (/\.(apk|aab|ipa)$/i.test(name)) {
          chosenName = name;
          chosenBytes = bytes as Uint8Array;
          break;
        }
      }
    }
    if (!chosenBytes || !chosenName) {
      return new Response(
        JSON.stringify({ error: "Artifact zip contained no app binary" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ext = chosenName.split(".").pop()!.toLowerCase();
    const contentType =
      ext === "apk" ? "application/vnd.android.package-archive" :
      "application/octet-stream";

    const safeName = String(build.app_name || "app").replace(/[^a-z0-9-_]+/gi, "_");

    return new Response(chosenBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}.${ext}"`,
        "Content-Length": String(chosenBytes.byteLength),
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
