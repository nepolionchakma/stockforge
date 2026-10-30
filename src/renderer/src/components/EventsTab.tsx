import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ClipboardCopy,
  Copy,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Wand2
} from 'lucide-react'
import type { EventKind, PromptRecord, PromptStyle } from '@shared/types'
import { categoryName } from '../data/categories'
import {
  MONTH_SHORT,
  YEAR_OPTIONS,
  daysUntil,
  formatLongDate,
  groupEventsByMonth
} from '../lib/dates'
import { PROMPT_STYLES, styleShort } from '../lib/promptEngine'
import { useApp } from '../state/AppContext'
import { Badge, Button, Eyebrow, IconButton, Select, cx } from './ui'

const KIND_LABELS: Record<EventKind, string> = {
  federal: 'Federal holiday',
  cultural: 'Cultural moment',
  seasonal: 'Seasonal moment',
  awareness: 'Awareness month',
  shopping: 'Shopping moment',
  food: 'Food moment'
}

const KIND_DOT: Record<EventKind, string> = {
  federal: 'bg-accent',
  cultural: 'bg-[#c59bff]',
  seasonal: 'bg-mint',
  awareness: 'bg-[#f08bb4]',
  shopping: 'bg-[#7db5ff]',
  food: 'bg-[#f5a06a]'
}

const FILTERS: Array<{ value: EventKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'federal', label: 'Federal' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'food', label: 'Food' }
]

export function EventsTab(): React.JSX.Element {
  const app = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EventKind | 'all'>('all')
  const [promptCount, setPromptCount] = useState(1)
  const [promptStyle, setPromptStyle] = useState<PromptStyle>('auto')

  const event = app.selectedEvent
  const [niche, setNiche] = useState(event.name)
  const [nicheKeywords, setNicheKeywords] = useState<string[]>([])
  const prompts = app.prompts[event.id] ?? []
  const aiEndpoints = app.aiSettings.endpoints.filter((endpoint) => endpoint.hasApiKey)
  const primaryAi = aiEndpoints[0]

  useEffect(() => {
    app.seedPrompts(event.id)
  }, [event.id, app.prompts, app.seedPrompts])

  useEffect(() => {
    setNiche(event.name)
    setNicheKeywords([])
  }, [event.id, event.name])

  const toggleNicheKeyword = (keyword: string): void => {
    const next = nicheKeywords.includes(keyword)
      ? nicheKeywords.filter((item) => item !== keyword)
      : [...nicheKeywords, keyword]
    setNicheKeywords(next)
    setNiche(next.length > 0 ? `${event.name} — ${next.join(', ')}` : event.name)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return app.events.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false
      if (!needle) return true
      const haystack = [
        item.name,
        item.blurb,
        item.palette,
        ...item.keywords,
        ...item.objects
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [app.events, filter, query])

  const groups = useMemo(() => groupEventsByMonth(filtered), [filtered])
  const days = daysUntil(event.date)
  const timing = event.isMonthLong
    ? 'All month'
    : days === null
      ? 'Date varies'
      : days === 0
        ? 'Starts today'
        : days > 0
          ? `Starts in ${days} days`
          : `Started ${Math.abs(days)} days ago`

  const copyAll = (): void => {
    if (prompts.length === 0) return
    void app.copyText(prompts.map((prompt) => prompt.text).join('\n\n'), 'All prompts copied')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-5 px-8 pb-5 pt-7">
        <div>              <Eyebrow>US CONTENT CALENDAR</Eyebrow>
              <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em] text-ink">
                Events &amp; prompts
              </h1>            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-relaxed text-muted">
            Pick a US holiday or cultural moment, then shape AI image prompts for your
            Adobe Stock object collections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-faint">
              Planning year
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted">Dates update instantly</div>
          </div>
          <div className="w-[104px]">
            <Select
              value={app.year}
              onChange={(event) => app.setYear(Number(event.target.value))}
              aria-label="Planning year"
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[352px_minmax(0,1fr)] gap-5 px-8 pb-6">
        <aside className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-2.5 border-b border-white/[0.055] p-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(inputEvent) => setQuery(inputEvent.target.value)}
                placeholder="Search holidays, moments, props..."
                className="field h-8.5 w-full rounded-lg border border-edge bg-white/[0.03] pl-8 pr-3 text-[11.5px] text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cx(
                    'rounded-full border px-2 py-[3px] text-[9.5px] font-medium transition-colors',
                    filter === option.value
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-white/[0.07] bg-white/[0.02] text-faint hover:border-white/[0.12] hover:text-muted'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-white/[0.045] px-3.5 py-2 text-[9.5px] uppercase tracking-[0.1em] text-faint">
            <span>{filtered.length} moments</span>
            <span>{app.year}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="px-6 py-12 text-center text-[11.5px] leading-relaxed text-faint">
                No events match “{query}”.
                <br />
                Try a different word or filter.
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.month}>
                  <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#12151c]/95 px-3.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-faint backdrop-blur">
                    {group.label}
                  </div>
                  {group.events.map((item) => {
                    const selected = item.id === event.id
                    const primary = item.isMonthLong
                      ? 'ALL'
                      : item.date
                        ? String(item.date.getDate()).padStart(2, '0')
                        : '—'
                    const secondary = item.isMonthLong
                      ? MONTH_SHORT[item.month - 1]
                      : item.date
                        ? MONTH_SHORT[item.date.getMonth()]
                        : MONTH_SHORT[item.month - 1]
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => app.selectEvent(item.id)}
                        className={cx(
                          'flex w-full items-center gap-3 border-l-2 px-3.5 py-2.5 text-left transition-colors',
                          selected
                            ? 'border-accent bg-white/[0.05]'
                            : 'border-transparent hover:bg-white/[0.025]'
                        )}
                      >
                        <span
                          className={cx(
                            'flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-center',
                            selected
                              ? 'border-accent/25 bg-accent-soft'
                              : 'border-white/[0.06] bg-white/[0.025]'
                          )}
                        >
                          <span
                            className={cx(
                              'text-[12px] font-semibold leading-4 tabular-nums',
                              selected ? 'text-accent' : 'text-ink'
                            )}
                          >
                            {primary}
                          </span>
                          <span className="text-[8.5px] font-medium uppercase tracking-[0.08em] text-faint">
                            {secondary}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-ink">
                            {item.name}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[9.5px] text-faint">
                            <span
                              className={cx('h-1.5 w-1.5 rounded-full', KIND_DOT[item.kind])}
                            />
                            <span className="truncate">{KIND_LABELS[item.kind]}</span>
                            {!item.isMonthLong ? (
                              <span className="truncate">· {item.dateLabel}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto pb-8 pr-1">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[9.5px] font-medium text-muted">
                  <span className={cx('h-1.5 w-1.5 rounded-full', KIND_DOT[event.kind])} />
                  {KIND_LABELS[event.kind]}
                </span>
                <span className="text-[10px] text-faint">Adobe category</span>
                <Badge>{event.category} · {categoryName(event.category)}</Badge>
              </div>
              <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink">
                {event.name}
              </h2>
              <p className="mt-2.5 max-w-[660px] text-[13px] leading-relaxed text-muted">
                {event.blurb}
              </p>
            </div>
            <div className="panel-flat w-[236px] shrink-0 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-faint">
                  Event date
                </span>
                <span className="text-[10px] tabular-nums text-faint">{app.year}</span>
              </div>
              <div className="mt-1.5 text-[17px] font-medium tracking-[-0.015em] text-ink">
                {event.dateLabel}
              </div>
              <div className="mt-1 text-[10.5px] leading-relaxed text-muted">
                {event.isMonthLong
                  ? 'Month-long content moment'
                  : formatLongDate(event.date)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone={days !== null && days >= 0 && days <= 45 ? 'accent' : 'neutral'}>
                  <CalendarDays className="h-3 w-3" />
                  {timing}
                </Badge>
              </div>
              {event.rule.type === 'table' ? (
                <p className="mt-2.5 text-[9.5px] leading-relaxed text-faint">
                  Religious and lunar dates can shift by a day with local observance.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[9.5px] font-medium uppercase tracking-[0.15em] text-faint">
              Keyword bank · {event.keywords.length}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[10.5px] text-muted"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className="panel mt-6 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent-soft text-accent">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-medium text-ink">Prompt studio</h3>
                    <Badge tone="accent">
                      {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'}
                    </Badge>
                    {app.generatePromptsWithAi && app.masterPrompt.trim() ? (
                      <Badge tone="info">Master prompt</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-faint">
                    <span
                      className={cx(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        app.generatePromptsWithAi ? 'bg-mint' : 'bg-faint'
                      )}
                    />
                    <span className="max-w-[220px] truncate" title={primaryAi?.model}>
                      {app.generatePromptsWithAi
                        ? `AI generation · ${primaryAi?.model ?? 'ready'}${
                            aiEndpoints.length > 1
                              ? ` +${aiEndpoints.length - 1} backup${
                                  aiEndpoints.length > 2 ? 's' : ''
                                }`
                              : ''
                          }`
                        : 'Offline prompt builder'}
                    </span>
                    <span className="shrink-0">· Edit before copying</span>
                  </div>
                </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  loading={app.generatingPrompts}
                  onClick={() =>
                    void app.generatePromptsFor(event.id, promptStyle, promptCount, niche)
                  }
                >
                  {app.generatingPrompts ? 'Generating…' : 'Generate'}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-8 items-center rounded-lg border border-edge bg-white/[0.03]">
                  <button
                    type="button"
                    className="flex h-full w-7 items-center justify-center text-faint transition-colors hover:text-ink"
                    onClick={() => setPromptCount((count) => Math.max(1, count - 1))}
                    disabled={promptCount <= 1 || app.generatingPrompts}
                    aria-label="Fewer prompts"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-[11px] font-medium tabular-nums text-ink">
                    {promptCount}
                  </span>
                  <button
                    type="button"
                    className="flex h-full w-7 items-center justify-center text-faint transition-colors hover:text-ink"
                    onClick={() => setPromptCount((count) => Math.min(20, count + 1))}
                    disabled={promptCount >= 20 || app.generatingPrompts}
                    aria-label="More prompts"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="w-[128px]">
                  <Select
                    value={promptStyle}
                    onChange={(styleEvent) =>
                      setPromptStyle(styleEvent.target.value as PromptStyle)
                    }
                    disabled={app.generatingPrompts}
                    aria-label="Prompt style"
                  >
                    {PROMPT_STYLES.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={app.whiteBackground}
                  aria-label="White background"
                  title="Add a pure white studio background to every generated prompt"
                  onClick={() => app.setWhiteBackground(!app.whiteBackground)}
                  disabled={app.generatingPrompts}
                  className={cx(
                    'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10.5px] font-medium transition-colors disabled:opacity-50',
                    app.whiteBackground
                      ? 'border-accent/35 bg-accent-soft text-accent'
                      : 'border-edge bg-white/[0.03] text-faint hover:text-ink'
                  )}
                >
                  <Square
                    className={cx(
                      'h-3 w-3',
                      app.whiteBackground ? 'fill-current' : 'fill-transparent'
                    )}
                  />
                  White background
                </button>
              </div>
            </div>

            <div className="border-b border-white/[0.055] px-4 py-3">
              <div className="flex flex-wrap items-end gap-2.5">
                <div className="min-w-[220px] flex-1">
                  <label
                    htmlFor={`niche-${event.id}`}
                    className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-faint"
                  >
                    Niche name
                  </label>
                  <input
                    id={`niche-${event.id}`}
                    value={niche}
                    onChange={(inputEvent) => setNiche(inputEvent.target.value)}
                    aria-label="Niche name"
                    placeholder={event.name}
                    className="field mt-1.5 h-8.5 w-full rounded-lg border border-edge bg-white/[0.03] px-2.5 text-[11.5px] text-ink placeholder:text-faint focus:outline-none"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNicheKeywords([])
                    setNiche(event.name)
                  }}
                  disabled={niche === event.name && nicheKeywords.length === 0}
                >
                  Reset to event
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.keywords.map((keyword) => {
                  const selected = nicheKeywords.includes(keyword)
                  return (
                    <button
                      key={keyword}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${selected ? 'Remove' : 'Add'} keyword ${keyword} to niche`}
                      onClick={() => toggleNicheKeyword(keyword)}
                      className={cx(
                        'rounded-md border px-2 py-1 text-[10px] transition-colors',
                        selected
                          ? 'border-accent/35 bg-accent-soft text-accent'
                          : 'border-white/[0.06] bg-white/[0.025] text-muted hover:border-white/[0.13] hover:text-ink'
                      )}
                    >
                      {selected ? '✓' : '+'} {keyword}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                Selecting keywords updates the NICHE NAME and replaces the prompt count in the
                master prompt at generation time.{' '}
                <span className="text-muted">White background</span> is on by default; switch it off
                to let prompts use scenes, surfaces and colored backdrops.
              </p>
            </div>

            <div className="space-y-2.5 p-4">
              {prompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.09] bg-white/[0.015] px-6 py-10 text-center">
                  <Sparkles className="h-6 w-6 text-faint" />
                  <h4 className="mt-3 text-[12.5px] font-medium text-ink">No prompts here yet</h4>
                  <p className="mt-1 max-w-[330px] text-[11px] leading-relaxed text-faint">
                    Generate a prompt for {event.name}. You can edit it, regenerate it, or
                    remove it.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    loading={app.generatingPrompts}
                    onClick={() => void app.addPrompt(event.id, promptStyle, niche)}
                  >
                    Add a prompt
                  </Button>
                </div>
              ) : (
                prompts.map((prompt, index) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    index={index}
                    busy={app.generatingPrompts}
                    onUpdate={(text) => app.updatePrompt(event.id, prompt.id, text)}
                    onRegenerate={() =>
                      void app.regeneratePrompt(event.id, prompt.id, niche)
                    }
                    onRemove={() => app.removePrompt(event.id, prompt.id)}
                    onCopy={() => app.copyText(prompt.text, 'Prompt copied')}
                  />
                ))
              )}

              {prompts.length > 0 ? (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    disabled={app.generatingPrompts}
                    onClick={() => void app.addPrompt(event.id, promptStyle, niche)}
                  >
                    Add prompt
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ClipboardCopy className="h-3.5 w-3.5" />}
                    onClick={copyAll}
                  >
                    Copy all
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function PromptCard({
  prompt,
  index,
  busy,
  onUpdate,
  onRegenerate,
  onRemove,
  onCopy
}: {
  prompt: PromptRecord
  index: number
  busy: boolean
  onUpdate: (text: string) => void
  onRegenerate: () => void
  onRemove: () => void
  onCopy: () => void
}): React.JSX.Element {
  const words = prompt.text.trim() ? prompt.text.trim().split(/\s+/).length : 0

  return (
    <div className="fade-up rounded-xl border border-white/[0.06] bg-white/[0.022] transition-colors focus-within:border-accent/25">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.045] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tabular-nums text-faint">
            {String(index + 1).padStart(2, '0')}
          </span>
          <Badge>{styleShort(prompt.style)}</Badge>
          <span className="text-[9.5px] text-faint">{words} words</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-edge bg-white/[0.03] px-2 text-[10.5px] font-medium text-muted transition-colors hover:border-accent/25 hover:bg-accent-soft hover:text-accent"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <IconButton label="Regenerate prompt" onClick={onRegenerate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove prompt" tone="danger" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
      <textarea
        value={prompt.text}
        onChange={(event) => onUpdate(event.target.value)}
        rows={4}
        spellCheck={false}
        className="min-h-[96px] w-full resize-y bg-transparent px-3.5 py-3 text-[12px] leading-[1.65] text-ink/90 placeholder:text-faint focus:outline-none"
        aria-label={`Prompt ${index + 1}`}
      />
    </div>
  )
}
