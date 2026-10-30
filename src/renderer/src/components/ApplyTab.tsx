import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderOpen,
  ImageDown,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import type { EmbedResult } from '@shared/types'
import { useApp } from '../state/AppContext'
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Eyebrow,
  IconButton,
  ProgressBar,
  Thumb,
  ToggleRow,
  cx
} from './ui'

function folderKey(path: string): string {
  return path.replace(/[\\/]+$/, '').toLowerCase()
}

function resultFor(results: EmbedResult[], sourcePath: string): EmbedResult | undefined {
  return results.find((result) => result.sourcePath === sourcePath)
}

export function ApplyTab(): React.JSX.Element {
  const app = useApp()

  const prepared = app.images.filter((image) => app.metadata[image.id])
  const selectedPrepared = prepared.filter((image) =>
    app.selectedImageIds.includes(image.id)
  )
  const missingMetadata = app.images.length - prepared.length
  const fieldsSelected =
    app.embedOptions.title || app.embedOptions.description || app.embedOptions.keywords
  const sameFolder =
    app.outputDir.length > 0 &&
    selectedPrepared.some((image) => folderKey(image.dir) === folderKey(app.outputDir))
  const allPreparedSelected =
    prepared.length > 0 &&
    prepared.every((image) => app.selectedImageIds.includes(image.id))
  const canApply =
    selectedPrepared.length > 0 &&
    Boolean(app.outputDir) &&
    fieldsSelected &&
    !sameFolder &&
    !app.embedding

  const savedCount = app.embedResults.filter((result) => result.status === 'saved').length
  const skippedCount = app.embedResults.filter((result) => result.status === 'skipped').length
  const failedCount = app.embedResults.filter((result) => result.status === 'failed').length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 px-8 pb-5 pt-7">
        <div>
          <Eyebrow>APPLY &amp; SAVE</Eyebrow>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em] text-ink">
            Embed metadata
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-muted">
            Copies are made into a separate folder and tagged with XMP/IPTC metadata. Your
            original files stay untouched.
          </p>
        </div>
        {app.outputDir ? (
          <Button
            variant="secondary"
            size="md"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            onClick={() => void app.openOutputFolder()}
          >
            Open output folder
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        <div className="grid grid-cols-[352px_minmax(0,1fr)] items-start gap-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] font-medium text-ink">Export settings</h2>
              <Badge tone={selectedPrepared.length > 0 ? 'accent' : 'neutral'}>
                {selectedPrepared.length} selected
              </Badge>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-faint">
              JPEG or PNG copies are written with the metadata you choose.
            </p>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  Output folder
                </span>
                {app.outputDir ? (
                  <span className="text-[9.5px] text-faint">separate from source</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="inset-field flex h-8 min-w-0 flex-1 items-center rounded-lg px-2.5"
                  title={app.outputDir || undefined}
                >
                  <span
                    className={cx(
                      'truncate text-[10.5px]',
                      app.outputDir ? 'text-ink/85' : 'text-faint'
                    )}
                  >
                    {app.outputDir || 'No folder chosen'}
                  </span>
                </div>
                {app.outputDir ? (
                  <IconButton
                    label="Open output folder"
                    onClick={() => void app.openOutputFolder()}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </IconButton>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                onClick={() => void app.chooseOutputFolder()}
              >
                Choose output folder
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Metadata to write
              </div>
              <div className="space-y-2">
                <ToggleRow
                  checked={app.embedOptions.title}
                  onChange={(value) => app.setEmbedOption('title', value)}
                  title="Title"
                  description="XMP title, IPTC object name and headline fields."
                />
                <ToggleRow
                  checked={app.embedOptions.description}
                  onChange={(value) => app.setEmbedOption('description', value)}
                  title="Description"
                  description="XMP description, IPTC caption and EXIF description."
                />
                <ToggleRow
                  checked={app.embedOptions.keywords}
                  onChange={(value) => app.setEmbedOption('keywords', value)}
                  title="Keywords"
                  description="XMP subject and IPTC keyword list."
                />
              </div>
            </div>

            <div className="mt-3">
              <ToggleRow
                checked={app.embedOptions.overwrite}
                onChange={(value) => app.setEmbedOption('overwrite', value)}
                title="Overwrite existing copies"
                description="Replace files already in the output folder."
              />
            </div>

            {missingMetadata > 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/[0.045] px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <div className="text-[10px] leading-relaxed text-[#e5bf8d]">
                  {missingMetadata} image{missingMetadata === 1 ? '' : 's'} still need metadata.{' '}
                  <button
                    type="button"
                    onClick={() => app.setActiveTab('metadata')}
                    className="font-medium underline underline-offset-2 hover:text-ink"
                  >
                    Open Metadata lab
                  </button>
                </div>
              </div>
            ) : null}

            {sameFolder ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/[0.055] px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <p className="text-[10px] leading-relaxed text-[#f1b4b6]">
                  Choose a folder outside the source folder. Originals are never overwritten.
                </p>
              </div>
            ) : null}

            {selectedPrepared.length === 0 ? (
              <p className="mt-4 text-[10px] leading-relaxed text-faint">
                Select prepared images in the queue on the right.
              </p>
            ) : null}

            <p className="mt-4 border-t border-white/[0.06] pt-4 text-[9.5px] leading-relaxed text-faint">
              Originals are never modified. Existing files are skipped unless overwrite is enabled.
            </p>
          </div>

          <div className="space-y-3">
            {app.embedResults.length > 0 ? (
              <div className="fade-up flex flex-wrap items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-mint" />
                <div className="text-[11px] text-ink">
                  <span className="font-medium">{savedCount} saved</span>
                  {skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
                  {failedCount > 0 ? ` · ${failedCount} failed` : ''}
                </div>
                <span className="ml-auto text-[9.5px] text-faint">
                  Last run · {app.embedResults.length} files
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="h-3.5 w-3.5" />}
                  onClick={() => void app.openOutputFolder()}
                >
                  Open folder
                </Button>
              </div>
            ) : null}

            <section className="panel flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.055] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    checked={allPreparedSelected}
                    onChange={() => {
                      if (allPreparedSelected) app.clearSelection()
                      else app.selectAllImages()
                    }}
                    disabled={prepared.length === 0 || app.embedding}
                    label="Select all prepared images"
                  />
                  <span className="text-[10.5px] text-muted">
                    {allPreparedSelected ? 'All prepared images selected' : 'Select prepared images'}
                  </span>
                </div>
                <div className="text-[9.5px] text-faint">
                  {prepared.length} ready · {app.images.length} in library
                </div>
              </div>

              {prepared.length === 0 ? (
                <EmptyState
                  icon={<ImageDown className="h-5 w-5" />}
                  title="Nothing ready to embed"
                  description="Generate metadata for your images first, then come back here to write it into separate copies."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                      onClick={() => app.setActiveTab('metadata')}
                    >
                      Generate metadata
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-white/[0.035]">
                  {prepared.map((image) => {
                    const selected = app.selectedImageIds.includes(image.id)
                    const result = resultFor(app.embedResults, image.path)
                    const meta = app.metadata[image.id]
                    return (
                      <div
                        key={image.id}
                        className={cx(
                          'flex items-center gap-3 px-4 py-2.5 transition-colors',
                          selected ? 'bg-white/[0.018]' : 'opacity-65'
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onChange={() => app.toggleSelectedImage(image.id)}
                          disabled={app.embedding}
                          label={`Include ${image.fileName}`}
                        />
                        <Thumb image={image} className="h-9 w-9 shrink-0" iconSize="h-3.5 w-3.5" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-ink">
                            {image.fileName}
                          </div>
                          <div className="mt-0.5 truncate text-[9.5px] text-faint">
                            {meta.title}
                          </div>
                          {result?.message ? (
                            <div
                              className={cx(
                                'mt-0.5 truncate text-[9px]',
                                result.status === 'failed' ? 'text-danger' : 'text-faint'
                              )}
                              title={result.message}
                            >
                              {result.message}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-[9px] text-faint">
                              {meta.keywords.length} keywords · {meta.category} category
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {result ? (
                            <Badge
                              tone={
                                result.status === 'saved'
                                  ? 'success'
                                  : result.status === 'failed'
                                    ? 'danger'
                                    : 'neutral'
                              }
                            >
                              {result.status === 'saved'
                                ? 'Saved'
                                : result.status === 'skipped'
                                  ? 'Skipped'
                                  : 'Failed'}
                            </Badge>
                          ) : selected ? (
                            <Badge tone="accent">Ready</Badge>
                          ) : (
                            <Badge>Not selected</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="flex items-start gap-2 px-1 text-[9.5px] leading-relaxed text-faint">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              Metadata is written with ExifTool to JPEG (XMP, IPTC, EXIF) and PNG (XMP)
              copies. Adobe Stock reads embedded metadata in Bridge and Lightroom; the CSV
              import remains the fastest bulk method.
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-edge bg-[#0b0d12]/95 px-8 py-3 backdrop-blur">
        {app.embedding && app.embedProgress ? (
          <div className="mb-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ProgressBar value={app.embedProgress.done} total={app.embedProgress.total} />
            </div>
            <span className="shrink-0 text-[9.5px] tabular-nums text-faint">
              {app.embedProgress.done}/{app.embedProgress.total}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-faint">
            <span>
              <span className="font-medium text-ink tabular-nums">{selectedPrepared.length}</span>{' '}
              selected
            </span>
            <span>·</span>
            <span>{app.outputDir ? 'Output folder ready' : 'Choose an output folder'}</span>
            {!fieldsSelected ? (
              <>
                <span>·</span>
                <span className="text-accent">Choose at least one field</span>
              </>
            ) : null}
            {sameFolder ? (
              <>
                <span>·</span>
                <span className="text-danger">Pick a folder outside the source</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[9.5px] text-faint sm:flex">
              <ShieldCheck className="h-3 w-3" />
              Originals untouched
            </span>
            <Button
              variant="primary"
              size="md"
              icon={<Download className="h-3.5 w-3.5" />}
              loading={app.embedding}
              disabled={!canApply}
              onClick={() => void app.applyMetadata()}
            >
              {app.embedding
                ? 'Saving copies...'
                : `Save ${selectedPrepared.length} cop${selectedPrepared.length === 1 ? 'y' : 'ies'}`}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
