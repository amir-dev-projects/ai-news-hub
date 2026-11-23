
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestConnectionPage() {
  const [status, setStatus] = useState("Testing connection...");
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("news_sources")
        .select("name")
        .order("name");

      if (error) {
        setStatus(`Connection failed: ${error.message}`);
        return;
      }

      setSources(data.map((source) => source.name));
      setStatus("Connected successfully!");
    }

    testConnection();
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>AI News Hub — Database Test</h1>
      <p>{status}</p>

      {sources.length > 0 && (
        <>
          <h2>News sources found: {sources.length}</h2>
          <ul>
            {sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
