import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
export const dataDir = path.join(root, 'data')
export const uploadsDir = path.join(dataDir, 'uploads')

fs.mkdirSync(uploadsDir, { recursive: true })

function filePath(name) {
  return path.join(dataDir, name)
}

export function readJson(name, fallback) {
  const file = filePath(name)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8')
    return structuredClone(fallback)
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return structuredClone(fallback)
  }
}

export function writeJson(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8')
}
