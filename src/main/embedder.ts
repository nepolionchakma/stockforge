import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join, normalize, resolve } from 'node:path'
import type { WebContents } from 'electron'
import { exiftool } from 'exiftool-vendored'
import type { EmbedItem, EmbedOptions, EmbedResult } from '../shared/types'

const ADOBE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

function sameDirectory(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

function buildTags(item: EmbedItem, options: EmbedOptions): Record<string, string | string[]> {
  const tags: Record<string, string | string[]> = {}
  const keywords = item.metadata.keywords
  const isJpeg = ['.jpg', '.jpeg'].includes(extname(item.fileName).toLowerCase())

  if (options.title) {
    tags['XMP-dc:Title'] = item.metadata.title
    if (isJpeg) tags['IPTC:ObjectName'] = item.metadata.title
  }

  if (options.description) {
    tags['XMP-dc:Description'] = item.metadata.description
    if (isJpeg) {
      tags['IPTC:Caption-Abstract'] = item.metadata.description
      tags['EXIF:ImageDescription'] = item.metadata.description
    }
  }

  if (options.keywords && keywords.length > 0) {
    tags['XMP-dc:Subject'] = keywords
    if (isJpeg) tags['IPTC:Keywords'] = keywords
  }

  return tags
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export async function embedAll(
  sender: WebContents,
  items: EmbedItem[],
  outputDir: string,
  options: EmbedOptions
): Promise<EmbedResult[]> {
  const results: EmbedResult[] = []
  const usedNames = new Set<string>()

  await fs.mkdir(outputDir, { recursive: true })

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const fileName = basename(item.fileName)
    sender.send('meta:embedProgress', {
      done: index,
      total: items.length,
      fileName
    })

    let target: string | null = null

    try {
      const extension = extname(fileName).toLowerCase()
      if (!ADOBE_EXTENSIONS.has(extension)) {
        throw new Error('Adobe Stock accepts JPG and PNG files. Convert this file first.')
      }

      if (sameDirectory(dirname(item.sourcePath), outputDir)) {
        throw new Error('The output folder must be different from the source folder.')
      }

      const nameKey = fileName.toLowerCase()
      if (usedNames.has(nameKey)) {
        results.push({
          sourcePath: item.sourcePath,
          outPath: null,
          fileName,
          status: 'skipped',
          message: 'Another selected file already uses this filename.'
        })
        continue
      }
      usedNames.add(nameKey)

      target = join(normalize(outputDir), fileName)

      if (!options.overwrite && (await fileExists(target))) {
        results.push({
          sourcePath: item.sourcePath,
          outPath: target,
          fileName,
          status: 'skipped',
          message: 'A file with this name already exists in the output folder.'
        })
        continue
      }

      await fs.copyFile(item.sourcePath, target)
      await exiftool.write(target, buildTags(item, options), {
        writeArgs: ['-overwrite_original', '-charset', 'iptc=utf8']
      })

      results.push({
        sourcePath: item.sourcePath,
        outPath: target,
        fileName,
        status: 'saved'
      })
    } catch (error) {
      if (target) {
        await fs.rm(target, { force: true }).catch(() => undefined)
      }
      results.push({
        sourcePath: item.sourcePath,
        outPath: null,
        fileName,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Could not write metadata.'
      })
    }
  }

  sender.send('meta:embedProgress', {
    done: items.length,
    total: items.length,
    fileName: ''
  })

  return results
}
