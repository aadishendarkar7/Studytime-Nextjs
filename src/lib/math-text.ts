/**
 * Prepares AI text for Markdown with math.
 * - \( \) and \[ \] become $ and $$, which the math renderer understands.
 * - A pair of single dollars is math only when what is between them looks like math
 *   (a backslash command, ^, _, braces, =, or a short expression like 2x + 1).
 *   Anything else, like "$5 and $10", is money and the dollars are escaped.
 * - Code blocks and inline code are left alone.
 */
export function normalizeMath(text: string) {
  const held: string[] = [];
  const hold = (s: string) => `\u0000${held.push(s) - 1}\u0000`;
  let t = text
    .replace(/```[\s\S]*?(?:```|$)/g, hold)
    .replace(/`[^`\n]+`/g, hold)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => hold(`$$${m}$$`))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => hold(`$${m.trim()}$`))
    .replace(/\$\$([\s\S]+?)\$\$/g, hold);

  let out = '';
  for (let i = 0; i < t.length; ) {
    const c = t[i];
    if (c === '\\' && t[i + 1] === '$') {
      out += '\\$';
      i += 2;
      continue;
    }
    if (c !== '$') {
      out += c;
      i++;
      continue;
    }
    let close = -1;
    for (let j = i + 1; j < t.length; j++) {
      if (t[j] === '\\') {
        j++;
        continue;
      }
      if (t[j] === '$') {
        close = j;
        break;
      }
      if (t[j] === '\n' && t[j + 1] === '\n') break;
    }
    const inner = close > i + 1 ? t.slice(i + 1, close) : '';
    if (inner && looksLikeMath(inner)) {
      out += hold(`$${inner.trim()}$`);
      i = close + 1;
    } else {
      out += '\\$';
      i++;
    }
  }
  t = out;
  for (let k = 0; k < 5 && t.includes('\u0000'); k++) t = t.replace(/\u0000(\d+)\u0000/g, (_, n: string) => held[Number(n)]);
  return t;
}

/** Between two dollar signs: math, or just text that happens to sit between two prices? */
export function looksLikeMath(s: string) {
  if (/[\\^_{}=<>]/.test(s)) return true;
  const x = s.trim();
  if (!x || x.length > 40) return false;
  // Words of three or more letters mean prose, as in "$5 and $10".
  if (/[a-zA-Z]{3,}/.test(x)) return false;
  // Short expressions with a variable: x, P, 2x + 1, f(x), A'.
  return /[a-zA-Z]/.test(x) && /^[\d\sa-zA-Z+\-*/().,'|!]+$/.test(x);
}

const LATEX = 'frac|dfrac|tfrac|times|theta|Theta|text|textbf|textit|tau|tan|tanh|to|top|triangle|triangleq|beta|begin|bar|binom|bmatrix|boldsymbol|big|bigg|bullet|nabla|neq|ne|nu|not|neg|newline|nolimits|rho|right|rangle|rceil|rfloor|rightarrow|forall|flat|frown|underline|uparrow|upsilon|cup|cap|cdot';
const LATEX_IN_JSON = new RegExp(`(?<!\\\\)\\\\(?=(?:${LATEX})(?![a-zA-Z]))`, 'g');

/**
 * Models often write LaTeX inside JSON strings with single backslashes. Some of those
 * are invalid JSON (\( or \sum), and worse, \frac, \times and \beta are valid escapes
 * that silently turn into control characters. This doubles them so they survive.
 */
export function repairJsonBackslashes(s: string) {
  return s
    .replace(LATEX_IN_JSON, '\\\\')
    .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    .replace(/(?<!\\)((?:\\\\)*)\\(?!["\\/bfnrtu])/g, '$1\\\\');
}
