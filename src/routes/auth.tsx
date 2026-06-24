import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - Notes" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/notes", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/notes", replace: true });
        } else {
          // Auto-confirm is on, but session might not be immediate — try sign in
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            setInfo("Account created. You can sign in now.");
            setMode("signin");
          } else {
            navigate({ to: "/notes", replace: true });
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/notes", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: "80px auto", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>
        {mode === "signin" ? "Sign in" : "Sign up"}
      </h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 8, background: "#111", color: "#fff", border: 0, borderRadius: 4, cursor: "pointer" }}
        >
          {loading ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        {error && <p style={{ color: "#c00", fontSize: 13 }}>{error}</p>}
        {info && <p style={{ color: "#060", fontSize: 13 }}>{info}</p>}
      </form>
      <button
        type="button"
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
        style={{ marginTop: 12, background: "none", border: 0, color: "#06c", cursor: "pointer", fontSize: 13 }}
      >
        {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
