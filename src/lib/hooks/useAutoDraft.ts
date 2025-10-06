// src/lib/hooks/useAutoDraft.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic auto-draft saver for New/Edit post forms.
 * - Debounced network save
 * - Offline localStorage backup + auto flush when reconnected
 * - beforeunload guard
 */
export type AutoDraftState = "idle" | "saving" | "saved" | "offline" | "error";

type CreateResp = { id: number };

export function useAutoDraft(opts: {
  mode: "new" | "edit";
  // Build minimal draft payload (title/content/…)
  buildPayload: () => any;
  // New -> POST draft; must return {id}
  createDraft?: (payload: any) => Promise<CreateResp>;
  // Edit or subsequent saves -> PATCH
  updateDraft: (id: number, payload: any) => Promise<void>;
  // Known id (edit mode) or undefined (new mode before first save)
  initialId?: number;
  // Unique key for localStorage backup
  storageKey: string;
  // Debounce ms
  debounceMs?: number;
  // When to consider “dirty”
  deps: any[];
}) {
  const {
    mode,
    buildPayload,
    createDraft,
    updateDraft,
    initialId,
    storageKey,
    debounceMs = 25000,
    deps,
  } = opts;

  const [draftId, setDraftId] = useState<number | undefined>(initialId);
  const [state, setState] = useState<AutoDraftState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onlineRef = useRef<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  // mark dirty on changes
  useEffect(() => {
    setDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // beforeunload guard
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && state !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, state]);

  // online/offline
  useEffect(() => {
    const onOnline = () => {
      onlineRef.current = true;
      // try flush backup if exists
      const raw = localStorage.getItem(storageKey);
      if (raw && draftId) {
        const payload = JSON.parse(raw);
        void updateDraft(draftId, payload)
          .then(() => {
            localStorage.removeItem(storageKey);
            setState("saved");
            setLastSavedAt(new Date());
            setDirty(false);
          })
          .catch(() => setState("error"));
      } else if (raw && mode === "new" && createDraft) {
        const payload = JSON.parse(raw);
        void createDraft(payload)
          .then((r) => {
            setDraftId(r.id);
            localStorage.removeItem(storageKey);
            setState("saved");
            setLastSavedAt(new Date());
            setDirty(false);
          })
          .catch(() => setState("error"));
      }
    };
    const onOffline = () => { onlineRef.current = false; setState("offline"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [createDraft, updateDraft, draftId, mode, storageKey]);

  // debounced auto-save
  const schedule = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const payload = buildPayload();

      // keep a lightweight backup always
      try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch {}

      if (!onlineRef.current) {
        setState("offline");
        return;
      }

      try {
        setState("saving");
        if (!draftId) {
          if (mode !== "new" || !createDraft) return; // safety
          const r = await createDraft(payload);
          setDraftId(r.id);
        } else {
          await updateDraft(draftId, payload);
        }
        setState("saved");
        setDirty(false);
        setLastSavedAt(new Date());
        // cleanup backup after success
        try { localStorage.removeItem(storageKey); } catch {}
      } catch {
        setState("error");
      }
    }, debounceMs) as unknown as number;
  }, [buildPayload, createDraft, updateDraft, draftId, debounceMs, mode, storageKey]);

  // whenever form gets dirty -> schedule a save
  useEffect(() => {
    if (!dirty) return;
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dirty, schedule]);

  return { state, lastSavedAt, draftId, setDraftId, touch: () => setDirty(true) };
}
