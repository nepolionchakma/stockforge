const STYLE_COUNT_TOKEN = '__STOCKFORGE_STYLE_COUNT__'
const STYLE_LINE_TOKEN = '__STOCKFORGE_STYLE_LINE__'

/**
 * Replaces the two values the user controls in a pasted master prompt:
 * the NICHE NAME and the fixed prompt count.
 *
 * The master document also contains "20 styles" and style list item "20.".
 * Those are not prompt counts, so they are protected during substitution.
 */
export function buildMasterPrompt(template: string, niche: string, count: number): string {
  const safeCount = Math.max(1, Math.min(20, Math.round(count) || 1))
  const safeNiche = niche.trim() || 'Commercial stock illustrations'
  let text = template.trim()
  if (!text) return ''

  text = text.replace(/PROMPT \[01[–-]20\]/g, `PROMPT [01–${String(safeCount).padStart(2, '0')}]`)
  text = text.replace(/\b20 styles\b/gi, STYLE_COUNT_TOKEN)
  text = text.replace(/^(\s*)20\.(\s)/gm, `$1${STYLE_LINE_TOKEN}.$2`)
  text = text.replace(/\b20\b/g, String(safeCount))
  text = text.replaceAll(STYLE_COUNT_TOKEN, '20 styles')
  text = text.replaceAll(STYLE_LINE_TOKEN, '20')

  if (/^\s*NICHE NAME\s*:/im.test(text)) {
    text = text.replace(
      /^(\s*NICHE NAME\s*:\s*).*$/gim,
      (_match, prefix: string) => `${prefix}${safeNiche}`
    )
  } else {
    text = `NICHE NAME: ${safeNiche}\n\n${text}`
  }

  return text
}
