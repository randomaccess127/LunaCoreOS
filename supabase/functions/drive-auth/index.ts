import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://dfpngowpkozggqiyrtrr.supabase.co",
  "https://lunacoreos.onrender.com"
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, cache-control, pragma, expires, if-modified-since, x-metadata, x-upload-content-type, x-upload-content-length",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "content-length, x-json, Location",
    "Vary": "Origin",
  };
}

// Helper to convert PEM to CryptoKey (Very robust version)
async function importPrivateKey(pem: string) {
  // 1. Remove headers, footers, and ALL whitespace (newlines, spaces, tabs)
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  // 2. Decode base64
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  // 3. Import as PKCS8
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// Helper to create JWT
async function createJWT(payload: any, privateKey: CryptoKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const encodedHeader = encode(header);
  const encodedPayload = encode(payload);
  
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- 1. Initialize Supabase Admin ---
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Auth] Missing Supabase Environment Variables");
    return new Response(JSON.stringify({ error: "Server Configuration Error (Missing Supabase Keys)" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // --- 2. Google Service Account Token Exchange ---
    const jsonKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!jsonKey) throw new Error("Missing secret GOOGLE_SERVICE_ACCOUNT_JSON");

    let sa;
    try {
      sa = JSON.parse(jsonKey);
    } catch (e) {
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON format");
    }

    const privateKey = await importPrivateKey(sa.private_key);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const jwt = await createJWT(payload, privateKey);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[Edge] Google Token Exchange Failed:", tokenRes.status, tokenData);
      throw new Error(`Google Token Exchange Failed: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("No access token in Google response");

    // --- 3. Handle Modes ---
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    const authHeader = req.headers.get("Authorization");
    
    let user = null;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      if (token && token !== "null" && token !== "undefined") {
        const { data: { user: identifiedUser }, error: userError } = await supabase.auth.getUser(token);
        if (userError) console.warn("[Edge] User identification failed:", userError.message);
        user = identifiedUser;
      }
    }
    
    if (mode === "store_token") {
      const { code } = await req.json();
      if (!user || !code) throw new Error("Missing user or auth code");
      
      const origin = req.headers.get("Origin") || "http://localhost:5173";
      console.log(`[Edge] Exchanging auth code for refresh token (Redirect: ${origin})...`);
      
      const exchangeRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: origin,
        }),
      });
      
      const exchangeData = await exchangeRes.json();
      if (!exchangeData.refresh_token) {
        console.error("[Edge] Exchange failed:", exchangeData);
        throw new Error("No refresh token returned from Google. Ensure you use 'prompt=consent' or 'access_type=offline'");
      }
      
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, google_refresh_token: exchangeData.refresh_token }
      });
      
      return new Response(JSON.stringify({ status: "saved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "upload") {
      let activeToken = accessToken;
      
      if (user?.user_metadata?.google_refresh_token) {
        console.log("[Edge] Found personal refresh token. Refreshing...");
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
            client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
            refresh_token: user.user_metadata.google_refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          activeToken = refreshData.access_token;
          console.log("[Edge] Using personal access token for upload.");
        }
      }

      const metadataStr = req.headers.get("x-metadata") || "{}";
      const metadata = JSON.parse(metadataStr);
      const contentType = req.headers.get("content-type") || req.headers.get("x-upload-content-type") || "application/octet-stream";
      const contentLength = req.headers.get("content-length") || req.headers.get("x-upload-content-length");
      const targetFolderId = "1hWZY9Uk-0u5pgUOEYVER91IPdReEVxuk";

      // IMPORTANT: Add 'parents' here so the file is created IN THE FOLDER.
      // This allows Service Accounts to use the folder's owner's quota.
      const initUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
      const driveInitRes = await fetch(initUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": contentLength || "0"
        },
        body: JSON.stringify({ 
          name: metadata.name || "Untitled",
          parents: [targetFolderId] 
        })
      });

      if (!driveInitRes.ok) {
        const errorText = await driveInitRes.text();
        throw new Error(`Drive Init Error: ${driveInitRes.status} - ${errorText}`);
      }

      const sessionUrl = driveInitRes.headers.get("Location");
      if (!sessionUrl) throw new Error("No session URL from Drive");

      const uploadRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: req.body
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload Failed: ${uploadRes.status} - ${errorText}`);
      }

      const driveData = await uploadRes.json();
      console.log("[Edge] Direct Folder Upload Success:", driveData.id);

      // Share (optional)
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${driveData.id}/permissions`, {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${activeToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            role: "writer",
            type: "user",
            emailAddress: "mdismail.dev@gmail.com"
          })
        });
      } catch (e) {}

      return new Response(JSON.stringify(driveData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify(tokenData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[Edge] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
