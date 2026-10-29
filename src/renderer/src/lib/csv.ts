import type { Metadata } from '@shared/types'

export interface CsvRow {
  fileName: string
  metadata: Metadata
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function cleanField(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Adobe Stock header order: Filename,Title,Keywords,Category,Releases
 * Categories are numeric IDs, keywords are comma separated and capped at 49.
 */
export function buildCsv(rows: CsvRow[]): string {
  const lines: string[] = ['Filename,Title,Keywords,Category,Releases']

  for (const row of rows) {
    const keywords = row.metadata.keywords
      .map((keyword) => cleanField(keyword))
      .filter(Boolean)
      .slice(0, 49)
      .join(',')
    lines.push(
      [
        escapeCsv(cleanField(row.fileName)),
        escapeCsv(cleanField(row.metadata.title).slice(0, 200)),
        escapeCsv(keywords),
        String(row.metadata.category),
        escapeCsv(cleanField(row.metadata.releases))
      ].join(',')
    )
  }

  return `${lines.join('\r\n')}\r\n`
}

export function csvFileName(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `adobe-stock-metadata-${year}-${month}-${day}.csv`
}
