const MATH_RE =
  /\b(solve for|what is \d+\s*[\+\-\*\/x×÷]\s*\d+|calculate|derivative|integral|pythagorean|quadratic formula)\b/i;
const CHATTER_RE =
  /\b(write (me )?a (poem|story|essay|song)|tell me a joke|who (won|is) the (president|super bowl)|translate this)\b/i;

export function looksOffTopicHeuristic(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (MATH_RE.test(text) || CHATTER_RE.test(text)) return true;
  if (/^[\d\s\+\-\*\/x×÷=\(\)\.]+$/.test(text) && text.length < 80) return true;
  return false;
}
