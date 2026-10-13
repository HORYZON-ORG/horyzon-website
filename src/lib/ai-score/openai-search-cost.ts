// Standard pricing checked against OpenAI's model and web-search docs on
// 2026-10-13. Reservations are estimates, not invoices or monetary guarantees.
export const OPENAI_SEARCH_MODEL = 'gpt-5';
export const OPENAI_SEARCH_RESERVATIONS:Record<string,number> = {
  // Tool $0.01 + (128k search + 2k prompt) * $1.25/M + 700 * $10/M.
  'gpt-5': 0.18,
  // Non-preview search content is billed at a fixed 8k input tokens/call:
  // tool $0.01 + (8k search + 3k prompt allowance) * $0.40/M
  // + 700 * $1.60/M = $0.01552, rounded up. Model availability is separate.
  'gpt-4.1-mini': 0.016,
};
export function openAIQueryReservation(model:string):number{
  return Object.hasOwn(OPENAI_SEARCH_RESERVATIONS,model)?OPENAI_SEARCH_RESERVATIONS[model]:Number.POSITIVE_INFINITY;
}
