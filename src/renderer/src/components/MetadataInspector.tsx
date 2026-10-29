import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { STOCK_CATEGORIES } from '../data/categories'
import { formatBytes, megapixels } from '../lib/imageAnalysis'
import { imageIssues, metadataIssues } from '../lib/metadataEngine'
import { useApp } from '../state/AppContext'
import { KeywordEditor } from './KeywordEditor'
import {
  Badge,
  Button,
  FieldLabel,
  IconButton,
  Select,
  TextInput,
  Thumb,
  cx
} from './ui'

export function MetadataInspector(): React.JSX.Element {
  const app = useApp()
  const image = app.activeImage
  const meta = app.activeMetadata

  if (!image) {
    return (
      <aside className="panel flex h-full min-h-0 flex-col items-center justify-center px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-faint">
          <MousePointerClick className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-[13px] font-medium text-ink">Select an image</h3>
        <p className="mt-1.5 max-w-[240px] text-[11px] leading-relaxed text-faint">
          Click a row in the table to edit its title, keywords and category before exporting.
        </p>
      </aside>
    )
  }

  const warnings = [...imageIssues(image), ...(meta ? metadataIssues(meta) : [])]
  const seriousWarnings = warnings.filter((warning) => !warning.includes('less scannable'))
  const suggestions = app.suggestionsFor(image)

  const removeImage = (): void => {
    if (window.confirm(`Remove "${image.fileName}" from this session?`)) {
      app.removeImage(image.id)
    }
  }

  return (
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-3">
        <div>
          <div className="text-[11.5px] font-medium text-ink">Image metadata</div>
          <div className="mt-0.5 text-[9.5px] text-faint">
            Single-image edit and copy
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Regenerate metadata" onClick={() => app.generateMetadataFor([image.id])}>
            <RefreshCw className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Close inspector" onClick={() => app.setActiveImageId(null)}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3.5">
          <div className="overflow-hidden rounded-xl border border-edge bg-black/25">
            <Thumb image={image} className="h-[120px] w-full rounded-none border-0" iconSize="h-7 w-7" />
          </div>

          <div className="mt-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-medium text-ink" title={image.fileName}>
                {image.fileName}
              </div>
              <div className="mt-0.5 text-[9.5px] tabular-nums text-faint">
                {image.width && image.height ? `${image.width} × ${image.height}` : 'Unreadable'} ·{' '}
                {megapixels(image)} · {formatBytes(image.bytes)}
              </div>
            </div>
            <IconButton label="Remove image" tone="danger" onClick={removeImage}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {image.colors.length > 0 ? (
              image.colors.map((color) => <Badge key={color}>{color}</Badge>)
            ) : (
              <Badge>no color read</Badge>
            )}
            <Badge>{image.brightness}</Badge>
            {image.hasAlpha ? <Badge tone="info">transparent</Badge> : null}
          </div>

          {!meta ? (
            <div className="mt-5 rounded-xl border border-dashed border-accent/25 bg-accent/[0.045] px-4 py-5 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-accent" />
              <h4 className="mt-2 text-[12px] font-medium text-ink">No metadata yet</h4>
              <p className="mt-1 text-[10.5px] leading-relaxed text-faint">
                Generate a title, keyword set and category for this image.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => app.generateMetadataFor([image.id])}
              >
                Generate metadata
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <FieldLabel
                  hint={
                    <span
                      className={cx(
                        'text-[9.5px] tabular-nums',
                        meta.title.length > 200
                          ? 'text-danger'
                          : meta.title.length > 70
                            ? 'text-accent'
                            : 'text-faint'
                      )}
                    >
                      {meta.title.length}/200
                    </span>
                  }
                >
                  Title
                </FieldLabel>
                <textarea
                  value={meta.title}
                  onChange={(event) => app.updateMetadata(image.id, { title: event.target.value })}
                  rows={2}
                  className="field w-full resize-y rounded-lg border border-edge bg-white/[0.03] px-2.5 py-2 text-[11.5px] leading-relaxed text-ink focus:outline-none"
                />
              </div>

              <div>
                <FieldLabel hint={<span className="text-[9.5px] text-faint">embedded only</span>}>
                  Description
                </FieldLabel>
                <textarea
                  value={meta.description}
                  onChange={(event) =>
                    app.updateMetadata(image.id, { description: event.target.value })
                  }
                  rows={3}
                  className="field w-full resize-y rounded-lg border border-edge bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-ink focus:outline-none"
                />
              </div>

              <div>
                <FieldLabel hint={<span className="text-[9.5px] text-faint">order matters</span>}>
                  Keywords
                </FieldLabel>
                <KeywordEditor
                  keywords={meta.keywords}
                  suggestions={suggestions}
                  onChange={(keywords) => app.updateMetadata(image.id, { keywords })}
                />
              </div>

              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <Select
                    value={meta.category}
                    onChange={(event) =>
                      app.updateMetadata(image.id, { category: Number(event.target.value) })
                    }
                    aria-label="Adobe Stock category"
                  >
                    {STOCK_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.id} · {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Releases</FieldLabel>
                  <TextInput
                    value={meta.releases}
                    onChange={(event) =>
                      app.updateMetadata(image.id, { releases: event.target.value })
                    }
                    placeholder="Optional"
                    aria-label="Release filenames"
                  />
                </div>
              </div>

              <div
                className={cx(
                  'rounded-lg border px-3 py-2.5',
                  seriousWarnings.length > 0
                    ? 'border-accent/20 bg-accent/[0.04]'
                    : 'border-mint/15 bg-mint/[0.035]'
                )}
              >
                {seriousWarnings.length > 0 ? (
                  <div className="space-y-1">
                    {seriousWarnings.slice(0, 4).map((warning) => (
                      <div
                        key={warning}
                        className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#e5bf8d]"
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-mint">
                    <CheckCircle2 className="h-3 w-3" />
                    Looks ready for Adobe Stock.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.055] p-3.5">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          icon={<Copy className="h-3.5 w-3.5" />}
          disabled={!meta}
          onClick={() => void app.copyMetadata(image.id)}
        >
          Copy metadata
        </Button>
        <Button
          variant="secondary"
          size="md"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          disabled={!meta}
          onClick={() => app.generateMetadataFor([image.id])}
        >
          Regenerate
        </Button>
      </div>
    </aside>
  )
}
