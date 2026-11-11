import { DEFAULT_GUIDANCE, frameProjection, guidanceLines, MAX_RENDER_BYTES, type Guidance, type Projection } from './render.js';

// Leave room for SDK dialect metadata, a bounded correlation id and framing.
export const MCP_RESULT_BUDGET_BYTES = MAX_RENDER_BYTES - 1024;
/**
 * Wrap authorized JSON data as text and structured content, budgeting both copies.
 * The text copy opens with the static first line of SPEC § 6.3 and adds the SPEC § 6.4 instruction
 * lines of a projection after its JSON line unless guidance is false; structured content stays the
 * bare value, so the line sits beside the projection, never inside it. `owner` is true only when
 * the server has identified the authenticated caller as the person the profile describes; absent
 * or false, the result takes the second first line and the reduced set of sentences.
 * Reserve 1 KiB of the 16 KiB message ceiling for transport metadata; overflow emits whole-result
 * absence, under the same first line, and a static diagnostic. Transport checks the final wire size.
 */
export function mcpResult(data: object, guidance: Guidance = DEFAULT_GUIDANCE, owner = false) {
  /**
   * Represent the same authorized value in framed text and structured content; the caller budgets both
   * copies together. Values without a projected profile or group carry no instruction lines.
   */
  const wrap = (value: object) => ({
    content: [{ type: 'text' as const, text: frameProjection(value as Projection, guidanceLines(value as Projection, guidance, owner), owner) }],
    structuredContent: value as Record<string, unknown>,
  });
  const result = wrap(data);
  if (new TextEncoder().encode(JSON.stringify(result)).length <= MCP_RESULT_BUDGET_BYTES) return result;
  console.error('RENDER_LIMIT');
  return wrap({ status: 'none' });
}
