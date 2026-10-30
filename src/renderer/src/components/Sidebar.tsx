import { useEffect, useState } from 'react'
import {
  Aperture,
  CalendarDays,
  ImageDown,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Tags
} from 'lucide-react'
import { useApp, type AppTab } from '../state/AppContext'
import { cx } from './ui'

const COLLAPSE_KEY = 'stockforge.sidebar.collapsed.v1'

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

function readCollapsed(): boolean {
  return localStorage.getItem(COLLAPSE_KEY) === 'true'
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }): React.JSX.Element {
  const app = useApp()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const prepared = app.images.filter((image) => app.metadata[image.id]).length
  const selectedReady = app.images.filter(
    (image) => app.selectedImageIds.includes(image.id) && app.metadata[image.id]
  ).length

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  const counts: Record<AppTab, number | null> = {
    events: null,
    metadata: prepared > 0 ? prepared : null,
    apply: selectedReady > 0 ? selectedReady : null
  }

  return (
    <aside
      className={cx(
        'flex shrink-0 flex-col overflow-hidden border-r border-edge bg-[#0b0d12]/90 transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[236px]'
      )}
    >
      <div
        className={cx(
          'flex items-center',
          collapsed ? 'flex-col gap-2 px-3 pb-5 pt-6' : 'gap-3 px-5 pb-6 pt-6'
        )}
      >
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#f6ca80] via-[#e7a64e] to-[#c8802d] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_8px_22px_-10px_rgba(240,179,95,.8)]">
          <Aperture className="h-[19px] w-[19px] text-[#241708]" strokeWidth={2} />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
              StockForge
            </div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-faint">
              Studio
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-faint transition-colors hover:border-edge hover:bg-white/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            collapsed ? '' : 'ml-auto'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className={collapsed ? 'px-2.5' : 'px-3'}>
        {!collapsed ? (
          <div className="px-2 pb-2 text-[9.5px] font-medium uppercase tracking-[0.18em] text-faint">
            Workspace
          </div>
        ) : null}
        <nav className={collapsed ? 'space-y-2' : 'space-y-1'}>
          {NAV_ITEMS.map((item) => {
            const active = app.activeTab === item.id
            const Icon = item.icon
            const count = counts[item.id]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => app.setActiveTab(item.id)}
                title={collapsed ? `${item.label} — ${item.description}` : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group flex w-full border text-left transition-colors',
                  collapsed
                    ? 'items-center justify-center rounded-xl px-0 py-2'
                    : 'items-center gap-3 rounded-xl px-2.5 py-2.5',
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
                {!collapsed ? (
                  <>
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
                  </>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>

      <div className={cx('mt-auto pb-4', collapsed ? 'px-2.5' : 'px-3')}>
        {!collapsed ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.022] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-mint" strokeWidth={2} />
              Adobe Stock ready
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
              CSV format, 49-keyword cap and embedded XMP metadata are built in.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings — AI key, font size"
          aria-label="Settings"
          className={cx(
            'group flex w-full items-center rounded-xl border border-transparent text-left transition-colors hover:bg-white/[0.03]',
            collapsed ? 'justify-center px-0 py-2' : 'mt-2 gap-3 px-2.5 py-2.5'
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.05] bg-white/[0.025] text-faint group-hover:text-muted">
            <Settings className="h-4 w-4" strokeWidth={1.9} />
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-muted group-hover:text-ink">
                Settings
              </span>
              <span className="mt-0.5 block text-[10px] text-faint">AI key, text size</span>
            </span>
          ) : null}
        </button>

        {!collapsed ? (
          <div className="mt-3 flex items-center justify-between px-1 text-[9.5px] text-faint">
            <span>StockForge Studio</span>
            <span className="tabular-nums">v1.0</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
