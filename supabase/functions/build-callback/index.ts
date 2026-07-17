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
    const { build_id, status, run_id, error_message, ext } = await req.json();

    if (!build_id) {
      return new Response(
        JSON.stringify({ error: "build_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const buildStatus = status === "success" ? "completed" : "failed";

    const updateData: any = {
      status: buildStatus,
      github_run_id: run_id || null,
      error_message: status !== "success" ? (error_message || `Build ${status}`) : null,
      updated_at: new Date().toISOString(),
    };

    if (ext && buildStatus === "completed") {
      updateData.storage_path = `${build_id}/app.${ext}`;
      updateData.file_name = `app.${ext}`;
    }

    await supabase.from("apk_builds").update(updateData).eq("id", build_id);

    return new Response(
      JSON.stringify({ success: true }),
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
