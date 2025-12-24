import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Find quotes that have been viewed but not acted upon
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Get quotes that meet abandonment criteria
    const { data: abandonedQuotes, error } = await supabase.rpc(
      "get_abandoned_quotes",
      {
        cutoff_24h: twentyFourHoursAgo,
        cutoff_2h: twoHoursAgo,
      },
    );

    if (error) {
      console.error("Failed to fetch abandoned quotes:", error);
      return NextResponse.json(
        { error: "Failed to fetch abandoned quotes" },
        { status: 500 },
      );
    }

    // Mark quotes as abandoned
    for (const quote of abandonedQuotes || []) {
      await supabase
        .from("quotes")
        .update({
          status: "Abandoned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", quote.id);

      // Log abandonment event
      await supabase.from("analytics_events").insert({
        event_type: "quote_abandoned",
        quote_id: quote.id,
        organization_id: quote.organization_id,
        properties: {
          abandonment_reason: quote.abandonment_reason,
          last_activity: quote.last_activity,
          days_since_last_activity: quote.days_since_last_activity,
        },
        created_at: new Date().toISOString(),
      });
    }

    // Get admin stats
    const { data: stats } = await supabase.rpc("get_abandonment_stats");

    return NextResponse.json({
      processed: abandonedQuotes?.length || 0,
      stats: stats || {},
    });
  } catch (error) {
    console.error("Abandonment detection error:", error);
    return NextResponse.json(
      { error: "Abandonment detection failed" },
      { status: 500 },
    );
  }
}
