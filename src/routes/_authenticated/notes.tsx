import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes" }] }),
  component: NotesPage,
});

type Note = { id: string; content: string; updated_at: string };

function NotesPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localWriteRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("notes")
      .select("id, content, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    let note = data as Note | null;
    if (!note) {
      const { data: created, error: createError } = await supabase
        .from("notes")
        .insert({ user_id: user.id, content: "" })
        .select("id, content, updated_at")
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }

      note = created;
    }

    setNoteId(note.id);
    setContent(note.content);
    contentRef.current = note.content;
    setUpdatedAt(note.updated_at);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!noteId) return;

    const channel = supabase
      .channel(`notes-sync-${noteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notes", filter: `id=eq.${noteId}` },
        (payload) => {
          if (Date.now() - localWriteRef.current < 2000) return;
          const next = payload.new as Note;
          setContent(next.content);
          contentRef.current = next.content;
          setUpdatedAt(next.updated_at);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function queueSave(nextContent: string) {
    if (!noteId) return;

    setContent(nextContent);
    contentRef.current = nextContent;
    setSaving(true);
    setError(null);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      localWriteRef.current = Date.now();
      const { data, error: saveError } = await supabase
        .from("notes")
        .update({ content: contentRef.current })
        .eq("id", noteId)
        .select("updated_at")
        .single();

      if (saveError) {
        setError(saveError.message);
      } else if (data) {
        setUpdatedAt(data.updated_at);
      }
      setSaving(false);
    }, 500);
  }

  async function flushSave() {
    if (!noteId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaving(true);
    localWriteRef.current = Date.now();
    const { data, error: saveError } = await supabase
      .from("notes")
      .update({ content: contentRef.current })
      .eq("id", noteId)
      .select("updated_at")
      .single();

    if (saveError) {
      setError(saveError.message);
    } else if (data) {
      setUpdatedAt(data.updated_at);
    }
    setSaving(false);
  }

  async function signOut() {
    await flushSave();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Notes</h1>
        <button onClick={signOut} style={buttonStyle}>Sign out</button>
      </header>
      {loading ? (
        <p style={mutedStyle}>Loading…</p>
      ) : (
        <>
          <textarea
            autoFocus
            value={content}
            onChange={(event) => queueSave(event.target.value)}
            onBlur={flushSave}
            placeholder="Start typing..."
            spellCheck={false}
            style={textareaStyle}
          />
          <p style={mutedStyle}>
            {error ? error : saving ? "Saving…" : updatedAt ? `Saved ${new Date(updatedAt).toLocaleString()}` : "Saved"}
          </p>
        </>
      )}
    </main>
  );
}

const pageStyle = {
  height: "100vh",
  maxWidth: 900,
  margin: "0 auto",
  padding: 16,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: "system-ui, sans-serif",
} satisfies Record<string, string | number>;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
} satisfies Record<string, string | number>;

const titleStyle = {
  fontSize: 18,
  margin: 0,
  fontWeight: 600,
} satisfies Record<string, string | number>;

const buttonStyle = {
  padding: "6px 10px",
  background: "#eee",
  color: "#111",
  border: "1px solid #ccc",
  borderRadius: 4,
  cursor: "pointer",
} satisfies Record<string, string | number>;

const textareaStyle = {
  flex: 1,
  width: "100%",
  minHeight: 0,
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: 4,
  padding: 12,
  resize: "none",
  outline: "none",
  fontFamily: "system-ui, sans-serif",
  fontSize: 16,
  lineHeight: 1.5,
  background: "#fff",
  color: "#111",
} satisfies Record<string, string | number>;

const mutedStyle = {
  margin: "8px 0 0",
  color: "#666",
  fontSize: 12,
};
