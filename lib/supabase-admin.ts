
import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Missing Supabase server environment variables. Check .env.local."
  );
}

const serverFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", "AI-News-Hub-Server/1.0");

  return fetch(input, {
    ...init,
    headers,
  });
};

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: serverFetch,
    },
  }
);
