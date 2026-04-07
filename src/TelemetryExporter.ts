import crypto from "node:crypto";
import { prisma } from "./db/prisma.ts";

interface TelemetryEventRow {
  id: string;
  timestamp: Date | string;
  eventType: string;
  details?: string | null;
}

interface TelemetryEvent {
  eventId: string;
  timestamp: Date | string;
  eventType: string;
  [key: string]: unknown;
}

export class TelemetryExporter {
  events: TelemetryEvent[];
  dbBuffer: ({ id: string; timestamp: string | Date; eventType: string; details: string })[];

  constructor() {
    this.events = [];
    this.dbBuffer = [];
    
    // Async Worker: Flush telemetry buffer to PostgreSQL every 2000ms
    // We use a non-blocking interval so it detaches from the main evaluation loop.
    setInterval(() => this.flush(), 2000);
    
    // Hydrate local cache gracefully
    this.hydrateFromDB();
  }

  private async hydrateFromDB() {
    try {
      const historical = await prisma.telemetryEvent.findMany({
        orderBy: { timestamp: 'desc' },
        take: 100
      });
      
      this.events = historical.map((row: TelemetryEventRow) => {
        let det = {};
        try { det = JSON.parse(row.details || "{}"); } catch(e) {}
        return {
          eventId: row.id,
          timestamp: row.timestamp,
          eventType: row.eventType,
          ...det
        };
      }).reverse();
    } catch(e) {
      console.error("Hydration warning: Database might not be fully initialized yet.");
    }
  }

  exportEvent(eventType: string, details: Record<string, unknown>) {
    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      ...details
    };

    // 1. StdOut logging for external collector agents
    console.log(JSON.stringify({ _aarm_telemetry: event }));

    // 2. Volatile RAM queue for immediate Dashboard reads
    this.events.push(event);
    if (this.events.length > 100) this.events.shift();
    
    // 3. Persistent Queue for async bulk-inserts
    this.dbBuffer.push({
      id: event.eventId,
      timestamp: event.timestamp,
      eventType,
      details: JSON.stringify(details)
    });
  }

  private async flush() {
    if (this.dbBuffer.length === 0) return;
    
    // Swap array reference to immediately free the ingestion queue buffer
    const batch = this.dbBuffer;
    this.dbBuffer = [];
    
    try {
      await prisma.telemetryEvent.createMany({
        data: batch,
        skipDuplicates: true
      });
    } catch (e) {
      console.error("Async Telemetry Bulk-Flush Error:", e);
      // In ultra-high-perf logging, dropping is preferred over crashing/OOMing the mediator.
    }
  }

  getRecentEvents() {
    return this.events;
  }
}

export const telemetryExporter = new TelemetryExporter();
