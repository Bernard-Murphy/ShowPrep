"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredToken } from "@/lib/auth-storage";
import { StreamingProgressMessage } from "@/components/streaming-progress-message";

type ProgressEvent = {
  status: string;
  stage: string;
  message: string;
  progress: number;
  processedCount: number;
  totalCount: number;
  error?: string | null;
};

type HarvestProgressStreamProps = {
  jobId: string | null;
  /** Called once when the stream reports COMPLETED or FAILED (refetch eligibility / clear UI). */
  onTerminal?: () => void;
  /** Called when the stream fails so the parent can refetch job status (e.g. job already FAILED). */
  onStreamError?: () => void;
};

function parseSseBlocks(buffer: string): { events: ProgressEvent[]; rest: string } {
  const events: ProgressEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const lines = block.split("\n");
    const dataLines = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    try {
      events.push(JSON.parse(payload) as ProgressEvent);
    } catch {
      // ignore malformed
    }
  }
  return { events, rest };
}

export function HarvestProgressStream({
  jobId,
  onTerminal,
  onStreamError,
}: HarvestProgressStreamProps) {
  const [event, setEvent] = useState<ProgressEvent | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const terminalNotifiedRef = useRef(false);
  const onTerminalRef = useRef(onTerminal);
  const onStreamErrorRef = useRef(onStreamError);
  onTerminalRef.current = onTerminal;
  onStreamErrorRef.current = onStreamError;

  useEffect(() => {
    terminalNotifiedRef.current = false;
    setEvent(null);
    setStreamError(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    const base =
      process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql";
    const url = `${base.replace(/\/graphql$/, "")}/api/processing/jobs/${jobId}/stream`;
    const token = getStoredToken();
    const controller = new AbortController();

    const applyEvent = (parsed: ProgressEvent) => {
      setStreamError(null);
      setEvent(parsed);
      if (
        (parsed.status === "COMPLETED" || parsed.status === "FAILED") &&
        !terminalNotifiedRef.current
      ) {
        terminalNotifiedRef.current = true;
        onTerminalRef.current?.();
      }
    };

    const run = async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: "text/event-stream",
          },
        });

        if (!response.ok) {
          let detail = `Progress stream failed (${response.status})`;
          try {
            const body = (await response.json()) as { message?: string };
            if (body?.message) detail = body.message;
          } catch {
            // ignore
          }
          if (response.status === 401) {
            detail = "Not authorized to load progress. Try signing in again.";
          } else if (response.status === 404) {
            detail = "Job not found.";
          }
          setStreamError(detail);
          onStreamErrorRef.current?.();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setStreamError("Progress stream is not available.");
          onStreamErrorRef.current?.();
          return;
        }

        const decoder = new TextDecoder();
        let carry = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          carry += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseBlocks(carry);
          carry = rest;
          for (const ev of events) {
            applyEvent(ev);
          }
        }
        carry += decoder.decode();
        const { events: finalEvents } = parseSseBlocks(carry.endsWith("\n\n") ? carry : `${carry}\n\n`);
        for (const ev of finalEvents) {
          applyEvent(ev);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStreamError((prev) => {
          if (prev) return prev;
          return "Could not load live progress. The job may still be running — refresh or check back shortly.";
        });
        onStreamErrorRef.current?.();
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [jobId]);

  const message = useMemo(() => {
    if (!event) return null;
    const suffix =
      event.totalCount > 0
        ? ` (${event.processedCount}/${event.totalCount})`
        : "";
    return `${event.stage}: ${event.message}${suffix}`;
  }, [event]);

  if (!jobId) return null;

  if (streamError && !message) {
    return (
      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">{streamError}</p>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">Connecting to harvest progress…</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
      <StreamingProgressMessage
        messageKey={`${event?.stage ?? "stage"}-${event?.progress ?? 0}`}
      >
        <p className="text-sm">{message}</p>
      </StreamingProgressMessage>
      <p className="text-xs text-muted-foreground mt-2">
        {event?.status} · {event?.progress ?? 0}%
      </p>
      {event?.error && (
        <p className="text-xs text-red-500 mt-1">{event.error}</p>
      )}
      {streamError && (
        <p className="text-xs text-destructive mt-2">{streamError}</p>
      )}
    </div>
  );
}
