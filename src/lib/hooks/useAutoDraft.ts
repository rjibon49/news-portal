// src/lib/hooks/useAutoDraft.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type AutoDraftState = "idle" | "saving" | "saved" | "offline" | "error";
type CreateResp = { id: number };

export function useAutoDraft(opts: {
  mode: "new" | "edit";
  buildPayload: () => any;
  createDraft?: (payload: any) => Promise<CreateResp>;
  updateDraft: (id: number, payload: any) => Promise<void>;
  initialId?: number;
  storageKey: string;
  debounceMs?: number;
  deps: any[];
}) {
  const {
    mode, buildPayload, createDraft, updateDraft,
    initialId, storageKey, debounceMs = 25000, deps,
  } = opts;

  const [draftId, setDraftId] = useState<number | undefined>(initialId);
  const [state, setState] = useState<AutoDraftState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);

  const timerRef = useRef<number | null>(null);
  const onlineRef = useRef<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  // NEW: lock to prevent double create
  const createLockRef = useRef<Promise<number> | null>(null);

  // mark dirty on changes
  useEffect(() => { setDirty(true); /* eslint-disable-next-line */ }, deps);

  // beforeunload guard
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && state !== "saved") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, state]);

  // online/offline
  useEffect(() => {
    const onOnline = () => {
      onlineRef.current = true;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const payload = JSON.parse(raw);
      (async () => {
        try {
          if (draftId) {
            await updateDraft(draftId, payload);
          } else if (mode === "new" && createDraft) {
            const r = await createDraft(payload);
            setDraftId(r.id);
          }
          localStorage.removeItem(storageKey);
          setState("saved"); setLastSavedAt(new Date()); setDirty(false);
        } catch { setState("error"); }
      })();
    };
    const onOffline = () => { onlineRef.current = false; setState("offline"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [createDraft, updateDraft, draftId, mode, storageKey]);

  // NEW: guarantee an id (awaits any in-flight create, or creates once)
  const ensureId = useCallback(async (): Promise<number> => {
    if (draftId) return draftId;
    if (mode !== "new") throw new Error("ensureId() called without an id in edit mode");
    if (!createDraft) throw new Error("createDraft not provided");

    if (!createLockRef.current) {
      const payload = buildPayload();
      createLockRef.current = createDraft(payload).then(r => {
        setDraftId(r.id);
        createLockRef.current = null;
        return r.id;
      }).catch(err => { createLockRef.current = null; throw err; });
    }
    return createLockRef.current;
  }, [draftId, mode, createDraft, buildPayload]);

  // debounced auto-save
  const schedule = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const payload = buildPayload();
      try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch {}

      if (!onlineRef.current) { setState("offline"); return; }

      try {
        setState("saving");
        const id = draftId ?? (mode === "new" ? await ensureId() : undefined);
        if (!id) return;

        await updateDraft(id, payload);
        setState("saved"); setDirty(false); setLastSavedAt(new Date());
        try { localStorage.removeItem(storageKey); } catch {}
      } catch { setState("error"); }
    }, debounceMs) as unknown as number;
  }, [buildPayload, updateDraft, draftId, debounceMs, mode, storageKey, ensureId]);

  useEffect(() => {
    if (!dirty) return;
    schedule();
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [dirty, schedule]);

  return { state, lastSavedAt, draftId, setDraftId, touch: () => setDirty(true), ensureId };
}
