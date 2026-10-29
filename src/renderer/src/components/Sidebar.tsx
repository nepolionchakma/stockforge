import { Aperture, CalendarDays, ImageDown, ShieldCheck, Tags } from 'lucide-react'
import { useApp, type AppTab } from '../state/AppContext'
import { cx } from './ui'

const NAV_ITEMS: Array<{
  id: AppTab
  label: string
  description: string
  icon: typeof CalendarDays
}> = [
  {
    id: 'events',
    label: 'Events & Prompts',
    description: 'US calendar + AI prompts',
    icon: CalendarDays
  },
  {
    id: 'metadata',
    label: 'Metadata',
    description: 'Titles, keywords, CSV',
    icon: Tags
  },
  {
    id: 'apply',
    label: 'Apply & Save',
    description: 'Embed + export copies',
    icon: ImageDown
  }
]

export function Sidebar(): React.JSX.Element {
  const app = useApp()
  const prepared = app.images.filter((image) => app.metadata[image.id]).length
  const selectedReady = app.images.filter(
    (image) => app.selectedImageIds.includes(image.id) && app.metadata[image.id]
  ).length

  const counts: Record<AppTab, number | null> = {
    events: null,
    metadata: prepared > 0 ? prepared : null,
    apply: selectedReady > 0 ? selectedReady : null
  }

  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-edge bg-[#0b0d12]/90">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#f6ca80] via-[#e7a64e] to-[#c8802d] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_8px_22px_-10px_rgba(240,179,95,.8)]">
          <Aperture className="h-[19px] w-[19px] text-[#241708]" strokeWidth={2} />
        </div>
        <div>
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">StockForge</div>
          <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-faint">
            Studio
          </div>
        </div>
      </div>

      <div className="px-3">
        <div className="px-2 pb-2 text-[9.5px] font-medium uppercase tracking-[0.18em] text-faint">
          Workspace
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = app.activeTab === item.id
            const Icon = item.icon
            const count = counts[item.id]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => app.setActiveTab(item.id)}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition-colors',
                  active
                    ? 'border-white/[0.08] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,.035)]'
                    : 'border-transparent hover:bg-white/[0.03]'
                )}
              >
                <span
                  className={cx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    active
                      ? 'border-accent/25 bg-accent-soft text-accent'
                      : 'border-white/[0.05] bg-white/[0.025] text-faint group-hover:text-muted'
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'block truncate text-[12px] font-medium',
                      active ? 'text-ink' : 'text-muted group-hover:text-ink'
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-faint">
                    {item.description}
                  </span>
                </span>
                {count !== null ? (
                  <span className="rounded-md border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] tabular-nums text-muted">
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.022] p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
            <ShieldCheck className="h-3.5 w-3.5 text-mint" strokeWidth={2} />
            Adobe Stock ready
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
            CSV format, 49-keyword cap and embedded XMP metadata are built in.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between px-1 text-[9.5px] text-faint">
          <span>StockForge Studio</span>
          <span className="tabular-nums">v1.0</span>
        </div>
      </div>
    </aside>
  )
}
