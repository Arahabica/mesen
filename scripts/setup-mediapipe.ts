// scripts/setup-mediapipe.ts
import { promises as fs } from 'fs'
import path from 'path'
import https from 'https'
import type { IncomingMessage } from 'http'

interface DownloadOptions {
  url: string
  dest: string
  onProgress?: (progress: number) => void
}

async function downloadFile({ url, dest, onProgress }: DownloadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleResponse = async (response: IncomingMessage) => {
      const status = response.statusCode ?? 0

      if (
        status >= 300 &&
        status < 400 &&
        response.headers?.location
      ) {
        const redirectUrl = new URL(response.headers.location, url).toString()
        response.resume()
        downloadFile({ url: redirectUrl, dest, onProgress })
          .then(resolve)
          .catch(reject)
        return
      }

      if (status !== 200) {
        response.resume()
        reject(new Error(`Failed to download: ${status}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      let fileHandle: fs.FileHandle | null = null
      let writeStream: fs.WriteStream | null = null
      let settled = false

      try {
        fileHandle = await fs.open(dest, 'w')
        writeStream = fileHandle.createWriteStream()
      } catch (error) {
        response.resume()
        reject(error)
        return
      }

      const cleanup = async (isError: boolean, error?: unknown) => {
        if (settled) {
          return
        }
        settled = true

        try {
          if (writeStream) {
            writeStream.close()
          }
        } catch (_) {
          // ignore
        }

        try {
          if (fileHandle) {
            await fileHandle.close()
          }
        } catch (_) {
          // ignore
        }

        if (isError || downloadedSize === 0) {
          await fs.unlink(dest).catch(() => {})
          reject(
            error instanceof Error
              ? error
              : isError
              ? new Error(String(error))
              : new Error('Downloaded file is empty')
          )
        } else {
          resolve()
        }
      }

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length
        if (totalSize && onProgress) {
          const progress = (downloadedSize / totalSize) * 100
          onProgress(progress)
        }
      })

      response.on('error', (error: unknown) => {
        void cleanup(true, error)
      })

      writeStream.on('error', (error: unknown) => {
        void cleanup(true, error)
      })

      writeStream.on('finish', () => {
        if (onProgress && totalSize) {
          onProgress(100)
        }
        void cleanup(false)
      })

      response.pipe(writeStream)
    }

    https
      .get(url, handleResponse)
      .on('error', async (error) => {
        await fs.unlink(dest).catch(() => {})
        reject(error)
      })
  })
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function showProgress(assetName: string) {
  return (progress: number) => {
    process.stdout.write(`\r  ${assetName}: ${progress.toFixed(2)}%`)
  }
}

interface ModelAsset {
  filename: string
  url: string
  label: string
  sizeMB: number
  required: boolean
}

interface SetupConfig {
  projectRoot: string
  publicDir: string
  modelsDir: string
  wasmDir: string
}

class MediaPipeSetup {
  private readonly config: SetupConfig
  private readonly modelAssets: ModelAsset[]

  constructor() {
    const projectRoot = process.cwd()
    const publicDir = path.join(projectRoot, 'public')

    this.config = {
      projectRoot,
      publicDir,
      modelsDir: path.join(publicDir, 'models'),
      wasmDir: path.join(publicDir, 'mediapipe', 'wasm')
    }

    this.modelAssets = [
      {
        filename: 'face_detection_short_range.task',
        url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
        label: 'Face Detector (Short Range)',
        sizeMB: 2.7,
        required: true
      },
    ]
  }

  async run(): Promise<void> {
    console.log('🚀 Setting up MediaPipe assets for Next.js...\n')

    await this.createDirectories()
    await this.downloadModels()
    await this.copyWasmFiles()
    await this.updateGitignore()

    process.stdout.write('\n')
    console.log('✅ Setup completed successfully!\n')
    console.log('📋 Next steps:')
    console.log('1. Run: npm run dev')
    console.log('2. Open: http://localhost:3000')
    console.log('3. Upload an image to verify face detection logs\n')
  }

  private async createDirectories(): Promise<void> {
    console.log('📁 Creating directories...')
    await fs.mkdir(this.config.modelsDir, { recursive: true })
    await fs.mkdir(this.config.wasmDir, { recursive: true })
    console.log('✓ Directories ready\n')
  }

  private async downloadModels(): Promise<void> {
    console.log('📥 Downloading MediaPipe model assets...')

    for (const asset of this.modelAssets) {
      const destination = path.join(this.config.modelsDir, asset.filename)

      const existingSize = await fs
        .stat(destination)
        .then((stats) => stats.size)
        .catch(() => 0)

      if (existingSize > 0) {
        console.log(`  ✓ ${asset.label} already present, skipping download`)
        continue
      }

      if (existingSize === 0 && (await fileExists(destination))) {
        console.log(`  ▸ Removing empty file for ${asset.label} before re-download`)
        await fs.unlink(destination)
      }

      console.log(`  ▸ ${asset.label} (~${asset.sizeMB} MB) downloading...`)
      try {
        await downloadFile({
          url: asset.url,
          dest: destination,
          onProgress: showProgress(asset.label)
        })
        process.stdout.write('\r')
        console.log(`  ✓ ${asset.label} saved to ${destination}`)
      } catch (error) {
        if (asset.required) {
          throw new Error(
            `Failed to download ${asset.label}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }

        console.warn(
          `  ⚠️  Optional asset "${asset.label}" could not be downloaded: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    }

    console.log('')
  }

  private async copyWasmFiles(): Promise<void> {
    console.log('📦 Copying WASM bundle from node_modules...')

    const nodeModulesWasm = path.join(
      this.config.projectRoot,
      'node_modules',
      '@mediapipe',
      'tasks-vision',
      'wasm'
    )

    if (!(await directoryExists(nodeModulesWasm))) {
      throw new Error(
        '@mediapipe/tasks-vision not found. Please run `npm install` before executing the setup script.'
      )
    }

    const files = await fs.readdir(nodeModulesWasm)
    let copiedCount = 0

    for (const file of files) {
      if (file.endsWith('.wasm') || file.endsWith('.js')) {
        const sourcePath = path.join(nodeModulesWasm, file)
        const destPath = path.join(this.config.wasmDir, file)
        await fs.copyFile(sourcePath, destPath)
        copiedCount += 1
        console.log(`  ✓ Copied ${file}`)
      }
    }

    if (copiedCount === 0) {
      throw new Error('No WASM artifacts were copied. Check the @mediapipe/tasks-vision package contents.')
    }

    console.log(`\n✓ Copied ${copiedCount} WASM files\n`)
  }

  private async updateGitignore(): Promise<void> {
    const gitignorePath = path.join(this.config.projectRoot, '.gitignore')
    const lines = [
      '# MediaPipe assets',
      'public/models/face_detection_short_range.task',
      'public/mediapipe/wasm/'
    ]

    try {
      const existingContent = await fs.readFile(gitignorePath, 'utf-8').catch(() => '')

      if (!lines.every((line) => existingContent.includes(line))) {
        const separator = existingContent.endsWith('\n') || existingContent.length === 0 ? '' : '\n'
        await fs.appendFile(gitignorePath, `${separator}${lines.join('\n')}\n`)
        console.log('📝 Added MediaPipe assets to .gitignore')
      }
    } catch (error) {
      console.warn(
        '⚠️  Could not update .gitignore:',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }
}

async function main(): Promise<void> {
  const setup = new MediaPipeSetup()

  try {
    await setup.run()
    process.exit(0)
  } catch (error) {
    console.error(
      '\n❌ Setup failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { MediaPipeSetup, downloadFile, directoryExists, fileExists }
