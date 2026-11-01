import { basename, dirname, extname, resolve } from 'node:path'
import sharp from 'sharp'

const [inputArgument, outputArgument, ...extraArguments] = process.argv.slice(2)

if (!inputArgument || !outputArgument || extraArguments.length > 0) {
  console.error('Usage: node scripts/resize-icon.mjs <input.png> <output-name>')
  process.exit(1)
}

const inputPath = resolve(inputArgument)
const outputBasePath = resolve(outputArgument)
const outputDirectory = dirname(outputBasePath)
const outputBaseName = basename(outputBasePath, extname(outputBasePath))

try {
  const image = sharp(inputPath, { failOn: 'error' })

  await Promise.all([192, 512].map(async (size) => {
    const outputPath = resolve(outputDirectory, `${outputBaseName}-${size}.png`)

    await image
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toFile(outputPath)

    console.log(`Created ${outputPath}`)
  }))
} catch (error) {
  console.error(`Could not resize icon: ${error.message}`)
  process.exitCode = 1
}
