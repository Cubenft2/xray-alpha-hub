import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Polygon API key from environment (server-side only)
    const apiKey = Deno.env.get('POLYGON_API_KEY');
    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    // Upgrade incoming connection to WebSocket
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    console.log('🔌 Upgrading client connection to WebSocket...');
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Connect to Polygon.io with server-side API key
    const polygonUrl = `wss://socket.polygon.io/crypto`;
    console.log(`📡 Connecting to Polygon.io at ${polygonUrl}`);
    const polygonSocket = new WebSocket(polygonUrl);

    // Forward authentication to Polygon
    polygonSocket.onopen = () => {
      console.log('✅ Connected to Polygon.io, authenticating...');
      polygonSocket.send(JSON.stringify({ action: "auth", params: apiKey }));
    };

    // Relay messages from Polygon to client
    polygonSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    // Relay messages from client to Polygon
    clientSocket.onmessage = (event) => {
      if (polygonSocket.readyState === WebSocket.OPEN) {
        polygonSocket.send(event.data);
      }
    };

    // Handle errors
    polygonSocket.onerror = (error) => {
      console.error('❌ Polygon WebSocket error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, 'Upstream error');
      }
    };

    clientSocket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (polygonSocket.readyState === WebSocket.OPEN) {
        polygonSocket.close();
      }
    };

    // Handle closures
    polygonSocket.onclose = () => {
      console.log('🔌 Polygon connection closed');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    clientSocket.onclose = () => {
      console.log('🔌 Client connection closed');
      if (polygonSocket.readyState === WebSocket.OPEN) {
        polygonSocket.close();
      }
    };

    return response;

  } catch (error) {
    console.error('❌ WebSocket proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
