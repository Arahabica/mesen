import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import path from 'path'
import https from 'https'

const MODEL_VERSION = '0.22.2'
const BASE_URL = `https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@${MODEL_VERSION}/weights`
const TARGET_DIR = path.join(process.cwd(), 'public', 'face-api')

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1'
]

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function downloadFile(sourceUrl: string, destinationPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(sourceUrl, (response) => {
        const statusCode = response.statusCode ?? 0

        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, sourceUrl).toString()
          response.resume()
          downloadFile(redirectUrl, destinationPath).then(resolve).catch(reject)
          return
        }

        if (statusCode !== 200) {
          response.resume()
          reject(new Error(`Download failed with status ${statusCode}`))
          return
        }

        const fileStream = createWriteStream(destinationPath)

        fileStream.on('error', (error) => {
          response.destroy()
          reject(error)
        })

        response.on('error', (error) => {
          fileStream.destroy()
          reject(error)
        })

        fileStream.on('finish', () => {
          resolve()
        })

        response.pipe(fileStream)
      })
      .on('error', reject)
  })
}

async function main(): Promise<void> {
  await ensureDir(TARGET_DIR)

  for (const file of FILES) {
    const destination = path.join(TARGET_DIR, file)
    const exists = await fileExists(destination)

    if (exists) {
      console.log(`✔︎ ${file} already exists`)
      continue
    }

    const url = `${BASE_URL}/${file}`
    console.log(`↓ Downloading ${file}`)
    await downloadFile(url, destination)
    console.log(`✔︎ Saved ${file}`)
  }
}

main().catch((error) => {
  console.error('Failed to set up face-api.js assets:', error)
  process.exitCode = 1
})
