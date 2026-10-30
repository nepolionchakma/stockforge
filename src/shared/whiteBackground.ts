/**
 * Shared white-background rules. Used by the main-process AI prompt writer and by
 * the renderer's offline prompt builder so both produce the same background.
 */

export const WHITE_BACKGROUND_CLAUSE =
  'Seamless pure white (#FFFFFF) studio background behind the fully isolated subject, generous clean white space around it, only a soft natural contact shadow, no scenery, no backdrop, no gradient, no texture, no text, no watermark.'

export const WHITE_BACKGROUND_INSTRUCTION = [
  'WHITE BACKGROUND REQUIREMENT — THIS RULE OVERRIDES EVERY EARLIER BACKGROUND, SCENE, SURFACE OR SETTING INSTRUCTION:',
  'Every prompt must show the main subject isolated on a seamless pure white (#FFFFFF) studio background.',
  'Do not describe a room, table, wall, landscape, snow scene, colored backdrop, gradient, texture or decorative background behind the subject.',
  'A soft natural contact shadow directly beneath the subject is allowed. Leave generous clean white space around it.',
  'The final image background must be pure white.'
].join('\n')

const WHITE_BACKGROUND_PATTERN = /pure white|white background|white backdrop|isolated on white/i
const NEGATIVE_PROMPT_PATTERN = /(?:^|\n)\s*negative prompt\s*:/i

/**
 * Guarantees the white-background clause is present exactly once, and inserts it
 * before a trailing "Negative prompt:" line when the model added one.
 */
export function ensureWhiteBackground(prompt: string): string {
  const text = prompt.trim()
  if (!text || WHITE_BACKGROUND_PATTERN.test(text)) return text

  const negativeIndex = text.search(NEGATIVE_PROMPT_PATTERN)
  if (negativeIndex >= 0) {
    return `${text.slice(0, negativeIndex).trimEnd()} ${WHITE_BACKGROUND_CLAUSE} ${text
      .slice(negativeIndex)
      .trimStart()}`
  }

  return `${text} ${WHITE_BACKGROUND_CLAUSE}`
}
