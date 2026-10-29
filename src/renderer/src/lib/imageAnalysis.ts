import type { ImageAsset, PickedFile } from '@shared/types'

export function imageUrl(filePath: string): string {
  return `stockforge://local/?path=${encodeURIComponent(filePath)}`
}

interface ColorInfo {
  colors: string[]
  brightness: ImageAsset['brightness']
  temperature: ImageAsset['temperature']
  hasAlpha: boolean
}

function classifyColor(r: number, g: number, b: number): { name: string; chromatic: boolean } | null {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  const delta = max - min

  if (max < 0.08) return { name: 'black', chromatic: false }
  if (delta < 0.045) {
    if (lightness > 0.92) return { name: 'white', chromatic: false }
    if (lightness > 0.72) return { name: 'cream', chromatic: false }
    return { name: 'gray', chromatic: false }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === rn) hue = ((gn - bn) / delta) % 6
  else if (max === gn) hue = (bn - rn) / delta + 2
  else hue = (rn - gn) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360

  if (saturation < 0.14 && lightness > 0.82) return { name: 'cream', chromatic: false }
  if (saturation < 0.12) return { name: lightness > 0.5 ? 'gray' : 'black', chromatic: false }
  if (hue >= 22 && hue <= 65 && lightness > 0.8 && saturation < 0.6) {
    return { name: 'cream', chromatic: false }
  }

  if (hue >= 345 || hue < 12) return { name: 'red', chromatic: true }
  if (hue < 40) {
    if (lightness < 0.34) return { name: 'brown', chromatic: true }
    return { name: 'orange', chromatic: true }
  }
  if (hue < 62) {
    if (lightness > 0.82 && saturation < 0.42) return { name: 'cream', chromatic: false }
    return { name: 'yellow', chromatic: true }
  }
  if (hue < 155) return { name: 'green', chromatic: true }
  if (hue < 190) return { name: 'teal', chromatic: true }
  if (hue < 248) return { name: 'blue', chromatic: true }
  if (hue < 290) return { name: 'purple', chromatic: true }
  return { name: 'pink', chromatic: true }
}

function analyzePixels(image: HTMLImageElement): ColorInfo {
  const maxSide = 56
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return { colors: [], brightness: 'balanced', temperature: 'neutral', hasAlpha: false }
  }
  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data

  const counts = new Map<string, { count: number; chromatic: boolean }>()
  let total = 0
  let alphaPixels = 0
  let redSum = 0
  let blueSum = 0
  let luminanceSum = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 24) continue
    total += 1
    if (alpha < 250) alphaPixels += 1
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    redSum += r
    blueSum += b
    luminanceSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

    const classification = classifyColor(r, g, b)
    if (!classification) continue
    const existing = counts.get(classification.name)
    if (existing) existing.count += 1
    else counts.set(classification.name, { count: 1, chromatic: classification.chromatic })
  }

  if (total === 0) {
    return { colors: [], brightness: 'balanced', temperature: 'neutral', hasAlpha: true }
  }

  const sorted = [...counts.entries()].sort(([, a], [, b]) => b.count - a.count)
  const chromatic = sorted.filter(([, value]) => value.chromatic && value.count / total >= 0.015)
  const neutral = sorted.filter(([, value]) => !value.chromatic)
  const chosen = chromatic.length > 0 ? chromatic.slice(0, 3) : neutral.slice(0, 2)

  const averageLuminance = luminanceSum / total
  const brightness: ImageAsset['brightness'] =
    averageLuminance < 0.34 ? 'dark' : averageLuminance > 0.7 ? 'light' : 'balanced'
  const colorBalance = (redSum - blueSum) / total
  const temperature: ImageAsset['temperature'] =
    colorBalance > 14 ? 'warm' : colorBalance < -14 ? 'cool' : 'neutral'

  return {
    colors: chosen.map(([name]) => name),
    brightness,
    temperature,
    hasAlpha: alphaPixels > total * 0.03
  }
}

function loadImage(src: string, anonymous: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (anonymous) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be read'))
    image.src = src
  })
}

async function analyzeFile(file: PickedFile): Promise<ImageAsset> {
  const src = imageUrl(file.path)
  const base: ImageAsset = {
    id: file.path,
    path: file.path,
    fileName: file.fileName,
    dir: file.dir,
    ext: file.ext,
    bytes: file.bytes,
    width: 0,
    height: 0,
    colors: [],
    brightness: 'balanced',
    temperature: 'neutral',
    hasAlpha: false,
    readable: false
  }

  try {
    let image: HTMLImageElement
    let anonymous = true
    try {
      image = await loadImage(src, true)
    } catch {
      anonymous = false
      image = await loadImage(src, false)
    }

    let colorInfo: ColorInfo = {
      colors: [],
      brightness: 'balanced',
      temperature: 'neutral',
      hasAlpha: false
    }

    if (anonymous) {
      try {
        colorInfo = analyzePixels(image)
      } catch {
        colorInfo = {
          colors: [],
          brightness: 'balanced',
          temperature: 'neutral',
          hasAlpha: false
        }
      }
    }

    return {
      ...base,
      width: image.naturalWidth,
      height: image.naturalHeight,
      colors: colorInfo.colors,
      brightness: colorInfo.brightness,
      temperature: colorInfo.temperature,
      hasAlpha: colorInfo.hasAlpha,
      readable: true
    }
  } catch {
    return base
  }
}

export async function analyzeFiles(files: PickedFile[]): Promise<ImageAsset[]> {
  const results: ImageAsset[] = []
  for (let index = 0; index < files.length; index += 4) {
    const chunk = files.slice(index, index + 4)
    const analyzed = await Promise.all(chunk.map((file) => analyzeFile(file)))
    results.push(...analyzed)
  }
  return results
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function megapixels(image: ImageAsset): string {
  if (!image.width || !image.height) return '—'
  return `${((image.width * image.height) / 1_000_000).toFixed(1)} MP`
}
