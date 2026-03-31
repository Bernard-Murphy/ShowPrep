"use client";

import { useEffect, useMemo, useState } from "react";
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

export function HarvestProgressStream({ jobId }: { jobId: string | null }) {
  const [event, setEvent] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const base =
      process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql";
    const url = `${base.replace(/\/graphql$/, "")}/api/processing/jobs/${jobId}/stream`;
    const source = new EventSource(url, { withCredentials: true });
    source.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as ProgressEvent;
        setEvent(parsed);
      } catch {
        // Ignore malformed events.
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
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

  if (!message) return null;

  return (
    <div className="mt-4">
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
    </div>
  );
}
