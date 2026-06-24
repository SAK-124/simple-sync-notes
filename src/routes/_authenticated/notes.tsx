import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes" }] }),
  component: NotesPage,
});

type Note = { id: string; content: string; updated_at: string };

function NotesPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("id, content, updated_at")
      .order("updated_at", { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notes-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, user.id]);

  async function addNote() {
    await supabase.from("notes").insert({ user_id: user.id, content: "" });
    load();
  }

  async function updateNote(id: string, content: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
    await supabase.from("notes").update({ content }).eq("id", id);
  }

  async function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Notes</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }}>{user.email}</span>
          <button onClick={signOut} style={btnSecondary}>Sign out</button>
        </div>
      </header>
      <button onClick={addNote} style={btnPrimary}>+ New note</button>
      {loading ? (
        <p style={{ color: "#666", marginTop: 16 }}>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: "#666", marginTop: 16 }}>No notes yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map((n) => (
            <li key={n.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8 }}>
              <textarea
                value={n.content}
                onChange={(e) => updateNote(n.id, e.target.value)}
                placeholder="Write something…"
                rows={4}
                style={{ width: "100%", border: 0, outline: "none", resize: "vertical", fontFamily: "inherit", fontSize: 14 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#999" }}>
                  {new Date(n.updated_at).toLocaleString()}
                </span>
                <button onClick={() => deleteNote(n.id)} style={btnDanger}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "6px 12px", background: "#111", color: "#fff", border: 0, borderRadius: 4, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "4px 10px", background: "#eee", color: "#111", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 12,
};
const btnDanger: React.CSSProperties = {
  padding: "4px 10px", background: "transparent", color: "#c00", border: 0, cursor: "pointer", fontSize: 12,
};
