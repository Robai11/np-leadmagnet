/*
 * Lead sink — open interface (Build-Spec §9). v1 just logs / appends locally;
 * a real CRM (e.g. HubSpot, with email + industry/device/channels as contact
 * properties) is wired in later by implementing LeadSink and swapping the
 * default export.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface Lead {
  email: string;
  /** Contact details from the report lead gate (optional for the legacy unlock). */
  firstName?: string;
  lastName?: string;
  phone?: string;
  url: string;
  industry: string;
  device: number;
  channels: string[];
  /** ISO-8601 timestamp, supplied by the caller. */
  capturedAt: string;
}

export interface LeadSink {
  capture(lead: Lead): Promise<void>;
}

/** Default sink: structured log + append to a local JSONL file (dev/v1). */
class LocalLeadSink implements LeadSink {
  async capture(lead: Lead): Promise<void> {
    console.log("[lead]", JSON.stringify(lead));
    try {
      const dir = join(process.cwd(), ".data");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, "leads.jsonl"), JSON.stringify(lead) + "\n");
    } catch (err) {
      // Never let lead persistence failure break the unlock flow.
      console.error("[lead] persist failed", err);
    }
  }
}

export const leadSink: LeadSink = new LocalLeadSink();
