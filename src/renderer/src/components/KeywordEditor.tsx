import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, CloseChip, cx } from './ui'

export function KeywordEditor({
  keywords,
  onChange,
  suggestions = []
}: {
  keywords: string[]
  onChange: (keywords: string[]) => void
  suggestions?: string[]
}): React.JSX.Element {
  const [input, setInput] = useState('')

  const addKeywords = (raw: string): void => {
    const incoming = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length >= 2)
    if (incoming.length === 0) return

    const next = [...keywords]
    for (const keyword of incoming) {
      if (next.length >= 49) break
      if (!next.some((value) => value.toLowerCase() === keyword)) next.push(keyword)
    }
    onChange(next)
    setInput('')
  }

  const removeKeyword = (keyword: string): void => {
    onChange(keywords.filter((value) => value !== keyword))
  }

  const missingSuggestions = suggestions
    .filter(
      (suggestion) =>
        !keywords.some((keyword) => keyword.toLowerCase() === suggestion.toLowerCase())
    )
    .slice(0, 10)

  return (
    <div>
      <div className="rounded-xl border border-edge bg-white/[0.03] p-2 focus-within:border-accent/35">
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.045] py-1 pl-2 pr-1 text-[10.5px] text-ink/85"
            >
              {keyword}
              <CloseChip onClick={() => removeKeyword(keyword)} />
            </span>
          ))}
          <div className="flex min-w-[130px] flex-1 items-center gap-1.5 px-1 py-0.5">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  addKeywords(input)
                } else if (event.key === 'Backspace' && input === '' && keywords.length > 0) {
                  removeKeyword(keywords[keywords.length - 1])
                }
              }}
              onPaste={(event) => {
                if (event.clipboardData.getData('text').includes(',')) {
                  event.preventDefault()
                  addKeywords(event.clipboardData.getData('text'))
                }
              }}
              placeholder={
                keywords.length >= 49 ? 'Keyword limit reached' : 'Add keyword, press Enter'
              }
              disabled={keywords.length >= 49}
              className="h-6 min-w-0 flex-1 bg-transparent text-[11px] text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => addKeywords(input)}
              disabled={!input.trim() || keywords.length >= 49}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-30"
              aria-label="Add keyword"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9.5px] text-faint">Comma or Enter to add · backspace removes</span>
        <span
          className={cx(
            'text-[9.5px] tabular-nums',
            keywords.length > 49
              ? 'text-danger'
              : keywords.length >= 5
                ? 'text-mint'
                : 'text-faint'
          )}
        >
          {keywords.length}/49
        </span>
      </div>
      {missingSuggestions.length > 0 ? (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-faint">
              Suggestions
            </span>
            <Badge>{missingSuggestions.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {missingSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addKeywords(suggestion)}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-1 text-[9.5px] text-faint transition-colors hover:border-accent/25 hover:bg-accent-soft hover:text-accent"
              >
                <Plus className="h-2.5 w-2.5" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
