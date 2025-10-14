import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const coinId = url.searchParams.get('coinId');
    const days = url.searchParams.get('days') || '7';
    const vsCurrency = url.searchParams.get('vs_currency') || 'usd';

    if (!coinId) {
      return new Response(
        JSON.stringify({ error: 'coinId parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build CoinGecko API URL with authentication
    const cgUrl = new URL(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`);
    cgUrl.searchParams.set('vs_currency', vsCurrency);
    cgUrl.searchParams.set('days', days);

    const headers: Record<string, string> = {
      'accept': 'application/json',
    };

    // Add API key if available
    if (COINGECKO_API_KEY) {
      headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
    }

    console.log(`Fetching CoinGecko chart data for ${coinId}, ${days} days`);
    
    const response = await fetch(cgUrl.toString(), { headers });

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `CoinGecko API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        } 
      }
    );

  } catch (error) {
    console.error('Error fetching CoinGecko chart data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});