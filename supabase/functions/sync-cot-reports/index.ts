import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CFTC Socrata API - Disaggregated Futures Only
const CFTC_API_URL = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json";

// Commodity codes for Silver and Gold in CFTC data
const COMMODITY_FILTERS = [
  { name: "SILVER", cftc_code: "084691" },
  { name: "GOLD", cftc_code: "088691" },
];

interface CFTCRecord {
  report_date_as_yyyy_mm_dd: string;
  cftc_contract_market_code: string;
  market_and_exchange_names: string;
  
  // Swap Dealers (note: CFTC API has typo with double underscores)
  swap_positions_long_all: string;
  swap__positions_short_all: string;  // double underscore in API
  swap__positions_spread_all: string; // double underscore in API
  
  // Producer/Merchant
  prod_merc_positions_long: string;
  prod_merc_positions_short: string;
  
  // Managed Money
  m_money_positions_long_all: string;
  m_money_positions_short_all: string;
  m_money_positions_spread: string;
  
  // Other Reportables
  other_rept_positions_long: string;
  other_rept_positions_short: string;
  other_rept_positions_spread: string;
  
  // Non-Reportables
  nonrept_positions_long_all: string;
  nonrept_positions_short_all: string;
  
  // Open Interest
  open_interest_all: string;
  
  // Changes (net change in swap and managed money)
  change_in_swap_long_all?: string;
  change_in_swap_short_all?: string;
  change_in_m_money_long_all?: string;
  change_in_m_money_short_all?: string;
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  const parsed = parseInt(val.replace(/,/g, ""), 10);
  return isNaN(parsed) ? null : parsed;
}

function calculateNet(long: number | null, short: number | null): number | null {
  if (long === null || short === null) return null;
  return long - short;
}

// COT data reflects positions as of Tuesday, released on Friday
// Calculate the "as of" date by subtracting 3 days from report date
function getAsOfDate(reportDateStr: string): string {
  const reportDate = new Date(reportDateStr);
  reportDate.setDate(reportDate.getDate() - 3);
  return reportDate.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[sync-cot-reports] Starting COT data sync from CFTC");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query for Silver and Gold, last 12 weeks of data
    const queryParams = new URLSearchParams({
      "$where": `cftc_contract_market_code in ('${COMMODITY_FILTERS.map(c => c.cftc_code).join("','")}')`,
      "$order": "report_date_as_yyyy_mm_dd DESC",
      "$limit": "50", // ~25 weeks per commodity
    });

    const apiUrl = `${CFTC_API_URL}?${queryParams}`;
    console.log("[sync-cot-reports] Fetching from CFTC:", apiUrl);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`CFTC API error: ${response.status} ${response.statusText}`);
    }

    const records: CFTCRecord[] = await response.json();
    console.log(`[sync-cot-reports] Received ${records.length} records from CFTC`);

    if (records.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No records returned from CFTC",
        inserted: 0,
        updated: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let upserted = 0;
    let errors: string[] = [];

    for (const record of records) {
      try {
        // Map CFTC code to our commodity name
        const commodityConfig = COMMODITY_FILTERS.find(
          c => c.cftc_code === record.cftc_contract_market_code
        );
        if (!commodityConfig) {
          console.log(`[sync-cot-reports] Unknown commodity code: ${record.cftc_contract_market_code}`);
          continue;
        }

        // Parse report date and calculate as_of_date (Tuesday before Friday release)
        const reportDate = record.report_date_as_yyyy_mm_dd.split('T')[0];
        const asOfDate = getAsOfDate(record.report_date_as_yyyy_mm_dd);

        // Parse all position data (note: CFTC API has typos with double underscores)
        const swapLong = parseNum(record.swap_positions_long_all);
        const swapShort = parseNum(record.swap__positions_short_all);
        const prodLong = parseNum(record.prod_merc_positions_long);
        const prodShort = parseNum(record.prod_merc_positions_short);
        const managedLong = parseNum(record.m_money_positions_long_all);
        const managedShort = parseNum(record.m_money_positions_short_all);
        const otherLong = parseNum(record.other_rept_positions_long);
        const otherShort = parseNum(record.other_rept_positions_short);
        const nonreptLong = parseNum(record.nonrept_positions_long_all);
        const nonreptShort = parseNum(record.nonrept_positions_short_all);

        // Calculate week-over-week changes from change fields
        const swapNetChange = calculateNet(
          parseNum(record.change_in_swap_long_all),
          parseNum(record.change_in_swap_short_all)
        );
        const managedNetChange = calculateNet(
          parseNum(record.change_in_m_money_long_all),
          parseNum(record.change_in_m_money_short_all)
        );

        const cotData = {
          commodity: commodityConfig.name,
          report_date: reportDate,
          as_of_date: asOfDate,
          
          // Swap Dealers ("Banks")
          swap_long: swapLong,
          swap_short: swapShort,
          swap_net: calculateNet(swapLong, swapShort),
          swap_spreading: parseNum(record.swap__positions_spread_all),
          
          // Producer/Merchant
          producer_long: prodLong,
          producer_short: prodShort,
          producer_net: calculateNet(prodLong, prodShort),
          
          // Managed Money (Speculators)
          managed_long: managedLong,
          managed_short: managedShort,
          managed_net: calculateNet(managedLong, managedShort),
          managed_spreading: parseNum(record.m_money_positions_spread),
          
          // Other Reportables
          other_long: otherLong,
          other_short: otherShort,
          other_net: calculateNet(otherLong, otherShort),
          other_spreading: parseNum(record.other_rept_positions_spread),
          
          // Non-Reportables
          nonreportable_long: nonreptLong,
          nonreportable_short: nonreptShort,
          nonreportable_net: calculateNet(nonreptLong, nonreptShort),
          
          // Totals
          open_interest: parseNum(record.open_interest_all),
          
          // Week-over-week changes
          swap_net_change: swapNetChange,
          managed_net_change: managedNetChange,
        };

        console.log(`[sync-cot-reports] Upserting ${commodityConfig.name} ${reportDate}, as_of: ${asOfDate}`);

        // Upsert into cot_reports
        const { error } = await supabase
          .from("cot_reports")
          .upsert(cotData, { 
            onConflict: "commodity,report_date",
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`[sync-cot-reports] Error upserting ${commodityConfig.name} ${reportDate}:`, error);
          errors.push(`${commodityConfig.name} ${reportDate}: ${error.message}`);
        } else {
          upserted++;
        }
      } catch (recordError) {
        console.error(`[sync-cot-reports] Error processing record:`, recordError);
        errors.push(`Record processing error: ${recordError.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-cot-reports] Completed in ${duration}ms. Upserted: ${upserted}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      records_fetched: records.length,
      upserted,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      duration_ms: duration,
      commodities: COMMODITY_FILTERS.map(c => c.name),
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("[sync-cot-reports] Fatal error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
