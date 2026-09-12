/** Render-only paragraph boundaries. Never reverse or rewrite stored caption text. */
export function directionalText(text: string, rtl: boolean, separator = '\n') {
  const mark = rtl ? '\u200f' : '\u200e';
  return text.split(separator).map(line => mark + line + mark).join(separator);
}
