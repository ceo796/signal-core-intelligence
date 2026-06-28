import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  Bold,
  CheckSquare,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Quote,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { customFetch } from "@workspace/api-client-react";
import { toast } from "sonner";

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  icon: string;
  isPinned: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotesListResponse {
  items: Note[];
}

type NotesMode = "active" | "archived";

interface DraftState {
  title: string;
  content: string;
  tags: string[];
}

const emptyDraft: DraftState = {
  title: "",
  content: "",
  tags: [],
};

const noteIconMap = {
  FileText,
};

function notesQueryKey(mode: NotesMode, search: string) {
  return ["notes", mode, search.trim()] as const;
}

async function listNotes(mode: NotesMode, search: string): Promise<NotesListResponse> {
  const params = new URLSearchParams();
  if (mode === "archived") params.set("archived", "true");
  if (search.trim()) params.set("search", search.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return customFetch<NotesListResponse>(`/notes${suffix}`, { responseType: "json" });
}

async function createNote(): Promise<Note> {
  return customFetch<Note>("/notes", {
    method: "POST",
    body: JSON.stringify({
      title: "Untitled",
      content: "",
      tags: [],
      icon: "FileText",
    }),
    responseType: "json",
  });
}

async function updateNote(id: number, patch: Partial<DraftState> & { isPinned?: boolean; archived?: boolean }): Promise<Note> {
  return customFetch<Note>(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    responseType: "json",
  });
}

async function deleteNote(id: number): Promise<void> {
  await customFetch(`/notes/${id}`, { method: "DELETE" });
}

function excerpt(content: string): string {
  const normalized = content
    .split("\n")
    .map((line) => line.replace(/^#+\s+/, "").replace(/^[-*]\s+/, "").replace(/^\[\s?]\s+/, "").trim())
    .filter(Boolean)
    .join(" ");
  return normalized || "No notes yet";
}

function formatUpdated(value: string): string {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "recently";
  }
}

function linePrefixInsert(content: string, selectionStart: number, selectionEnd: number, prefix: string) {
  const lineStart = content.lastIndexOf("\n", selectionStart - 1) + 1;
  const before = content.slice(0, lineStart);
  const selected = content.slice(lineStart, selectionEnd);
  const after = content.slice(selectionEnd);
  const body = selected || content.slice(lineStart, selectionStart);
  const replacement = body
    ? body
        .split("\n")
        .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
        .join("\n")
    : prefix;
  return {
    content: `${before}${replacement}${after}`,
    cursor: before.length + replacement.length,
  };
}

function wrapSelection(content: string, selectionStart: number, selectionEnd: number, marker: string) {
  const selected = content.slice(selectionStart, selectionEnd) || "text";
  const before = content.slice(0, selectionStart);
  const after = content.slice(selectionEnd);
  return {
    content: `${before}${marker}${selected}${marker}${after}`,
    cursor: before.length + marker.length + selected.length,
  };
}

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<NotesMode>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [tagInput, setTagInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const hydratedNoteId = useRef<number | null>(null);

  const notesQuery = useQuery({
    queryKey: notesQueryKey(mode, search),
    queryFn: () => listNotes(mode, search),
  });

  const notes = notesQuery.data?.items ?? [];
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? notes[0] ?? null,
    [notes, selectedId],
  );

  const invalidateNotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: (note) => {
      setMode("active");
      setSearch("");
      setSelectedId(note.id);
      invalidateNotes();
      toast.success("Note created");
    },
    onError: () => toast.error("Could not create note"),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<DraftState> }) => updateNote(id, patch),
    onMutate: () => setSaveState("saving"),
    onSuccess: (note) => {
      queryClient.setQueryData<NotesListResponse | undefined>(notesQueryKey(mode, search), (current) => {
        if (!current) return current;
        return {
          items: current.items.map((item) => (item.id === note.id ? note : item)),
        };
      });
      setSaveState("saved");
    },
    onError: () => {
      setSaveState("dirty");
      toast.error("Could not save note");
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { isPinned?: boolean; archived?: boolean } }) => updateNote(id, patch),
    onSuccess: (note) => {
      setSelectedId(note.archivedAt && mode === "active" ? null : note.id);
      invalidateNotes();
    },
    onError: () => toast.error("Could not update note"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      setSelectedId(null);
      invalidateNotes();
      toast.success("Note deleted");
    },
    onError: () => toast.error("Could not delete note"),
  });

  useEffect(() => {
    if (!selectedNote) {
      setDraft(emptyDraft);
      hydratedNoteId.current = null;
      setSaveState("idle");
      return;
    }

    if (hydratedNoteId.current === selectedNote.id) return;
    setDraft({
      title: selectedNote.title,
      content: selectedNote.content,
      tags: selectedNote.tags,
    });
    setTagInput("");
    hydratedNoteId.current = selectedNote.id;
    setSaveState("saved");
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNote || hydratedNoteId.current !== selectedNote.id) return;
    if (
      draft.title === selectedNote.title &&
      draft.content === selectedNote.content &&
      JSON.stringify(draft.tags) === JSON.stringify(selectedNote.tags)
    ) {
      return;
    }

    setSaveState("dirty");
    const handle = window.setTimeout(() => {
      const title = draft.title.trim() || "Untitled";
      saveMutation.mutate({
        id: selectedNote.id,
        patch: {
          title,
          content: draft.content,
          tags: draft.tags,
        },
      });
    }, 700);

    return () => window.clearTimeout(handle);
  }, [draft, saveMutation, selectedNote]);

  const activePinned = notes.filter((note) => note.isPinned);
  const activeOthers = notes.filter((note) => !note.isPinned);

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, "");
    if (!tag || draft.tags.includes(tag) || draft.tags.length >= 12) return;
    setDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }

  function applyEditorAction(action: "h1" | "h2" | "bullet" | "todo" | "quote" | "bold" | "italic") {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const next =
      action === "bold"
        ? wrapSelection(draft.content, selectionStart, selectionEnd, "**")
        : action === "italic"
          ? wrapSelection(draft.content, selectionStart, selectionEnd, "_")
          : linePrefixInsert(
              draft.content,
              selectionStart,
              selectionEnd,
              action === "h1" ? "# " : action === "h2" ? "## " : action === "todo" ? "[ ] " : action === "quote" ? "> " : "- ",
            );
    setDraft((current) => ({ ...current, content: next.content }));
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.cursor, next.cursor);
    });
  }

  const currentIcon = selectedNote ? noteIconMap[selectedNote.icon as keyof typeof noteIconMap] ?? FileText : FileText;
  const CurrentIcon = currentIcon;

  return (
    <Layout>
      <div className="s87-page">
        <header className="s87-page-header flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-foreground">Notes</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Capture thinking, diligence threads, and decision notes beside your document work.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setSidebarOpen((value) => !value)}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              className="h-9 gap-2"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className={cn(
              "w-full shrink-0 border-r border-border bg-sidebar/70 md:w-[320px] md:block",
              sidebarOpen ? "block" : "hidden",
            )}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search notes"
                    className="h-9 bg-card pl-9 pr-8"
                  />
                  {search && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setSearch("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 rounded-md bg-muted p-1 text-xs">
                  <button
                    type="button"
                    className={cn("rounded px-2 py-1.5", mode === "active" && "bg-card text-foreground shadow-xs")}
                    onClick={() => setMode("active")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={cn("rounded px-2 py-1.5", mode === "archived" && "bg-card text-foreground shadow-xs")}
                    onClick={() => setMode("archived")}
                  >
                    Archived
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-2 md:pb-2">
                {notesQuery.isLoading ? (
                  <div className="space-y-2 p-2">
                    {[...Array(6)].map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />
                    ))}
                  </div>
                ) : notesQuery.error ? (
                  <div className="m-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    Could not load notes.
                  </div>
                ) : notes.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <FileText className="mb-3 h-9 w-9 text-muted-foreground" />
                    <h2 className="text-sm font-medium">No notes yet</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start a workspace note for a brief, deal, source trail, or meeting.
                    </p>
                    <Button
                      className="mt-4 h-9 gap-2"
                      size="sm"
                      onClick={() => createMutation.mutate()}
                    >
                      <Plus className="h-4 w-4" />
                      New note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activePinned.length > 0 && (
                      <NoteGroup
                        title="Pinned"
                        notes={activePinned}
                        selectedId={selectedNote?.id ?? null}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setSidebarOpen(false);
                        }}
                      />
                    )}
                    <NoteGroup
                      title={activePinned.length > 0 ? "Notes" : mode === "archived" ? "Archived" : "Recent"}
                      notes={activeOthers}
                      selectedId={selectedNote?.id ?? null}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setSidebarOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className={cn("min-w-0 flex-1 overflow-auto bg-background", sidebarOpen && "hidden md:block")}>
            {!selectedNote ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Choose a note</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Select a note from the list or create a new page for your research trail.
                </p>
              </div>
            ) : (
              <article className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-5 md:px-10 md:py-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CurrentIcon className="h-4 w-4" />
                    <span>{saveState === "saving" ? "Saving..." : saveState === "dirty" ? "Unsaved" : "Saved"}</span>
                    <span aria-hidden="true">/</span>
                    <span>Updated {formatUpdated(selectedNote.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        actionMutation.mutate({
                          id: selectedNote.id,
                          patch: { isPinned: !selectedNote.isPinned },
                        })
                      }
                    >
                      {selectedNote.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {mode === "archived" ? (
                          <DropdownMenuItem
                            onClick={() => actionMutation.mutate({ id: selectedNote.id, patch: { archived: false } })}
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => actionMutation.mutate({ id: selectedNote.id, patch: { archived: true } })}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate(selectedNote.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Untitled"
                  className="mb-3 w-full border-0 bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground md:text-4xl"
                />

                <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-4">
                  {draft.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2 text-xs text-accent-foreground"
                    >
                      #{tag}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Add tag"
                    className="h-7 w-28 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="sticky top-0 z-10 -mx-2 mb-3 flex flex-wrap items-center gap-1 border-y border-border bg-background/95 px-2 py-2 backdrop-blur">
                  <EditorButton label="H1" icon={Heading1} onClick={() => applyEditorAction("h1")} />
                  <EditorButton label="H2" icon={Heading2} onClick={() => applyEditorAction("h2")} />
                  <EditorButton label="Bold" icon={Bold} onClick={() => applyEditorAction("bold")} />
                  <EditorButton label="Italic" icon={Italic} onClick={() => applyEditorAction("italic")} />
                  <EditorButton label="Bullet" icon={List} onClick={() => applyEditorAction("bullet")} />
                  <EditorButton label="Task" icon={CheckSquare} onClick={() => applyEditorAction("todo")} />
                  <EditorButton label="Quote" icon={Quote} onClick={() => applyEditorAction("quote")} />
                </div>

                <Textarea
                  ref={textAreaRef}
                  value={draft.content}
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  placeholder="Type '/' in your head and start shaping the thought. Use the toolbar for headings, lists, tasks, and quotes."
                  className="min-h-[55vh] resize-none border-0 bg-transparent px-0 py-2 font-sans text-base leading-7 shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
                />
              </article>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}

function NoteGroup({
  title,
  notes,
  selectedId,
  onSelect,
}: {
  title: string;
  notes: Note[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <section>
      <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelect(note.id)}
            className={cn(
              "w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-card",
              selectedId === note.id && "border-border bg-card shadow-xs",
            )}
          >
            <div className="flex items-center gap-2">
              {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
              <span className="truncate text-sm font-medium text-foreground">{note.title || "Untitled"}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{excerpt(note.content)}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{formatUpdated(note.updatedAt)}</span>
              {note.tags.length > 0 && <span className="truncate">#{note.tags.slice(0, 2).join(" #")}</span>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EditorButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={onClick}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
