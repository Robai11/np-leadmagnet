/*
 * E-Mail gate (Build-Spec §6/§10). Locked findings stay SERVER-SIDE — the
 * client never receives their prose until the user unlocks with an email. No
 * CSS-blur of real content in the DOM.
 *
 * This transform sits between the analysis pipeline and the client stream:
 *  - `page` events are redacted (lever prose blanked) before being forwarded.
 *  - The full result is buffered and handed to `onComplete` for server-side
 *    caching (the unlock endpoint reads it back).
 *  - Once the hero page is known, exactly ONE full lever — the teaser — is sent
 *    (Build-Spec §9: "Hebel #1 vollständig lesbar"), then `done`.
 */

import { rankPages } from "@/lib/scoring";
import type { AnalysisResult, AnalyzedPage, Lever } from "@/lib/types";
import type { AnalysisEvent } from "@/lib/analysis/events";

/** Strip the prose a locked card must not reveal; keep pin/impact/range/category. */
function redactLever(l: Lever): Lever {
  return { ...l, title: "", observation: "", mechanism: "", test: "" };
}

function redactPage(p: AnalyzedPage): AnalyzedPage {
  return { ...p, levers: p.levers.map(redactLever) };
}

export async function* gateStream(
  source: AsyncGenerator<AnalysisEvent>,
  onComplete: (full: AnalysisResult) => void,
): AsyncGenerator<AnalysisEvent> {
  const fullPages: AnalyzedPage[] = [];
  const notes: string[] = [];
  let meta: AnalysisResult["meta"] | null = null;
  let overall: AnalysisResult["overall"] | null = null;

  for await (const e of source) {
    switch (e.type) {
      case "page":
        fullPages.push(e.page);
        yield { type: "page", page: redactPage(e.page) };
        break;
      case "meta":
        meta = e.meta;
        yield e;
        break;
      case "overall":
        overall = e.overall;
        yield e;
        break;
      case "note":
        notes.push(e.note);
        yield e;
        break;
      case "done": {
        const hero = rankPages(fullPages)[0];
        const lever = hero?.levers[0];
        if (hero && lever) yield { type: "teaser", pageId: hero.id, lever };
        if (meta && overall) {
          onComplete({ meta, overall, pages: fullPages, notes });
        }
        yield { type: "done" };
        break;
      }
      default:
        yield e; // progress, error
    }
  }
}

/** Turn a cached full result into the same event sequence (for instant replay). */
export async function* eventsFromResult(
  result: AnalysisResult,
): AsyncGenerator<AnalysisEvent> {
  yield { type: "meta", meta: result.meta };
  for (const page of result.pages) yield { type: "page", page };
  for (const note of result.notes) yield { type: "note", note };
  yield { type: "overall", overall: result.overall };
  yield { type: "done" };
}
