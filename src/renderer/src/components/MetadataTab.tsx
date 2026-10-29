import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  FolderPlus,
  Images,
  Sparkles
} from 'lucide-react'
import { categoryName } from '../data/categories'
import { formatBytes, megapixels } from '../lib/imageAnalysis'
import { imageIssues, metadataIssues } from '../lib/metadataEngine'
import { useApp } from '../state/AppContext'
import { MetadataInspector } from './MetadataInspector'
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Eyebrow,
  Select,
  Thumb,
  cx
} from './ui'

export function MetadataTab(): React.JSX.Element {
  const app = useApp()

  const prepared = useMemo(
    () => app.images.filter((image) => app.metadata[image.id]),
    [app.images, app.metadata]
  )
  const selectedCount = app.selectedImageIds.length
  const allSelected =
    app.images.length > 0 && app.images.every((image) => app.selectedImageIds.includes(image.id))

  const generateCount = selectedCount > 0 ? selectedCount : app.images.length
  const exportCount = app.images.filter(
    (image) =>
      app.metadata[image.id] &&
      (selectedCount > 0 ? app.selectedImageIds.includes(image.id) : true)
  ).length

  const exportName = app.lastExportPath?.split(/[\\/]/).pop() ?? ''

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-end justify-between gap-4 px-8 pb-5 pt-7">
        <div className="min-w-0 flex-1">
          <Eyebrow>Adobe Stock workflow</Eyebrow>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em] text-ink">
            Metadata lab
          </h1>
          <p className="mt-1.5 max-w-[610px] text-[12.5px] leading-relaxed text-muted">
            Generate titles, keywords and categories from an event context, edit them per
            image, then export a ready-to-import CSV.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<FolderPlus className="h-3.5 w-3.5" />}
            loading={app.importing}
            onClick={() => void app.addImages()}
          >
            Add images
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            disabled={app.images.length === 0 || app.importing}
            onClick={() => app.generateMetadataFor()}
          >
            {selectedCount > 0 ? `Generate for ${generateCount}` : 'Generate all'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            disabled={exportCount === 0}
            onClick={() => void app.exportCsv()}
          >
            Export CSV
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-8 pb-6">
        <div className="panel-flat flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-faint">
              Event context
            </span>
            <div className="w-[245px]">
              <Select
                value={app.metadataEventId ?? 'none'}
                onChange={(event) =>
                  app.setMetadataEventId(event.target.value === 'none' ? null : event.target.value)
                }
                aria-label="Event context for metadata"
              >
                <option value="none">No event context</option>
                {app.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} · {event.dateLabel}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {app.metadataEvent ? (
            <Badge tone="accent">
              <CalendarDays className="h-3 w-3" />
              {app.metadataEvent.dateLabel} {app.year}
            </Badge>
          ) : (
            <Badge>generic stock metadata</Badge>
          )}
          <div className="h-4 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-3.5 text-[10.5px] text-muted">
            <span>
              <span className="font-medium tabular-nums text-ink">{app.images.length}</span> images
            </span>
            <span>
              <span className="font-medium tabular-nums text-ink">{prepared.length}</span> prepared
            </span>
            <span>
              <span className="font-medium tabular-nums text-ink">{selectedCount}</span> selected
            </span>
          </div>
          <span className="ml-auto text-[9.5px] text-faint">
            {selectedCount > 0
              ? 'Generate and export use your selection.'
              : 'No selection means all images are used.'}
          </span>
        </div>

        {app.lastExportPath ? (
          <div className="fade-up flex flex-wrap items-center gap-2 rounded-xl border border-mint/15 bg-mint/[0.04] px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-mint" />
            <span className="text-[10.5px] font-medium text-mint">CSV exported</span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-faint">
              {exportName} · {app.lastExportPath}
            </span>
            <button
              type="button"
              onClick={() => void app.showExportFile()}
              className="text-[10px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Show file
            </button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="h-3 w-3" />}
              onClick={() => app.setActiveTab('apply')}
            >
              Apply &amp; save
            </Button>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-4">
          <section className="panel flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.055] px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={allSelected}
                  onChange={() =>
                    allSelected ? app.clearSelection() : app.selectAllImages()
                  }
                  disabled={app.images.length === 0}
                  label="Select all images"
                />
                <span className="text-[10.5px] text-muted">
                  {selectedCount > 0 ? `${selectedCount} selected` : 'No selection'}
                </span>
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={app.clearSelection}
                    className="text-[9.5px] text-faint underline-offset-2 hover:text-ink hover:underline"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-[9.5px] text-faint">
                <span>{prepared.length} prepared</span>
                <span>·</span>
                <span>{app.images.length} in library</span>
              </div>
            </div>

            {app.images.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={<Images className="h-5 w-5" />}
                  title="Start with your image batch"
                  description="Add one or many JPG or PNG files. StockForge reads their dimensions and colors, then builds Adobe Stock metadata around your chosen event."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FolderPlus className="h-3.5 w-3.5" />}
                      loading={app.importing}
                      onClick={() => void app.addImages()}
                    >
                      Add images
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="min-w-0">
                  <div className="grid grid-cols-[26px_36px_minmax(100px,1.05fr)_minmax(100px,1.4fr)_42px_20px] items-center gap-2 border-b border-white/[0.045] px-3.5 py-2 text-[9px] font-medium uppercase tracking-[0.13em] text-faint">
                    <span />
                    <span />
                    <span>Image</span>
                    <span>Title</span>
                    <span>Kw</span>
                    <span />
                  </div>
                  {app.images.map((image) => {
                    const meta = app.metadata[image.id]
                    const issues = [
                      ...imageIssues(image),
                      ...(meta ? metadataIssues(meta) : [])
                    ]
                    const active = app.activeImageId === image.id
                    const selected = app.selectedImageIds.includes(image.id)
                    return (
                      <div
                        key={image.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => app.setActiveImageId(image.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            app.setActiveImageId(image.id)
                          }
                        }}
                        className={cx(
                          'grid w-full cursor-pointer grid-cols-[26px_36px_minmax(100px,1.05fr)_minmax(100px,1.4fr)_42px_20px] items-center gap-2 border-b border-white/[0.035] border-l-2 px-3.5 py-2.5 text-left transition-colors focus:outline-none',
                          active
                            ? 'border-l-accent bg-white/[0.05]'
                            : 'border-l-transparent hover:bg-white/[0.022]'
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onChange={() => app.toggleSelectedImage(image.id)}
                          label={`Select ${image.fileName}`}
                        />
                        <Thumb image={image} className="h-8 w-8" iconSize="h-3.5 w-3.5" />
                        <div className="min-w-0">
                          <div
                            className="truncate text-[11px] font-medium text-ink"
                            title={image.fileName}
                          >
                            {image.fileName}
                          </div>
                          <div className="mt-0.5 truncate text-[8.5px] tabular-nums text-faint">
                            {image.width && image.height
                              ? `${image.width} × ${image.height}`
                              : 'Unreadable'}{' '}
                            · {megapixels(image)} · {formatBytes(image.bytes)}
                          </div>
                        </div>
                        <div className="min-w-0">
                          {meta ? (
                            <div className="line-clamp-2 text-[10.5px] leading-snug text-muted">
                              {meta.title}
                            </div>
                          ) : (
                            <div className="text-[10px] italic text-faint">No metadata yet</div>
                          )}
                          {meta ? (
                            <div className="mt-1 truncate text-[9px] text-faint">
                              {meta.category} · {categoryName(meta.category)}
                            </div>
                          ) : null}
                        </div>
                        <div>
                          {meta ? (
                            <Badge tone={meta.keywords.length >= 5 ? 'neutral' : 'danger'}>
                              {meta.keywords.length} kw
                            </Badge>
                          ) : (
                            <span className="text-[9.5px] text-faint">—</span>
                          )}
                        </div>
                        <div
                          className="flex justify-end"
                          title={issues.length > 0 ? issues.join('\n') : 'Looks ready'}
                        >
                          {!meta ? (
                            <CircleDashed className="h-3.5 w-3.5 text-faint" />
                          ) : issues.length > 0 ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-mint" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <MetadataInspector />
        </div>
      </div>
    </div>
  )
}
