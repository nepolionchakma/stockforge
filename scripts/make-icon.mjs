import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const svgPath = path.join(root, 'build', 'icon.svg')
const svg = await fs.readFile(svgPath)

await sharp(svg).resize(512, 512).png().toFile(path.join(root, 'build', 'icon.png'))
const png256 = await sharp(svg).resize(256, 256).png().toBuffer()

// A single-entry ICO that embeds a 256x256 PNG (supported by Windows Vista+).
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

const directory = Buffer.alloc(16)
directory.writeUInt8(0, 0)
directory.writeUInt8(0, 1)
directory.writeUInt8(0, 2)
directory.writeUInt8(0, 3)
directory.writeUInt16LE(1, 4)
directory.writeUInt16LE(32, 6)
directory.writeUInt32LE(png256.length, 8)
directory.writeUInt32LE(22, 12)

await fs.writeFile(path.join(root, 'build', 'icon.ico'), Buffer.concat([header, directory, png256]))
console.log('Wrote build/icon.png and build/icon.ico')
