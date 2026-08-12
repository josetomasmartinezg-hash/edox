import { randomUUID } from 'crypto'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'

const HEADER_RE =
  /^(según se requiera|mantenimiento inicial\b|cada\s+\d{1,3}(?:[.\s]?\d{3})*\s*(?:horas?|km|kil[oó]metros?).*)/i

const STOP_RE =
  /^(piezas requeridas|manual original|descripci[oó]n|copyright|printed in|worldwide construction)/i

const NOISE_RE =
  /(contin[uú]a en la siguiente|mb\d+|t\d{6}|--\s*\d+\s*of\s*\d+\s*--|illustruction|deere & company|all rights are reserved|previous edition)/i

const COL_HEADER_RE =
  /^(tipo|intervalo|horas?|km|trabajo|item|ítem|descripci[oó]n|tarea|pauta|actividad)$/i

const TITLE_RE =
  /^(programa de mantenimiento|intervalos de mantenimiento|motoniveladora\b|tiempos operativos)/i

export function isPautaFile(file) {
  const name = String(file?.originalname || '')
  const mime = String(file?.mimetype || '').toLowerCase()
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return true
  if (/\.(xlsx|xls|csv)$/i.test(name)) return true
  if (/spreadsheet|excel|csv/.test(mime)) return true
  return false
}

function slugId() {
  return randomUUID()
}

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[□■☐▪•\-–]+\s*/, '')
    .trim()
}

function isHeader(line) {
  return HEADER_RE.test(line)
}

function looksLikeTask(line) {
  return /^(revisi[oó]n|cambio|lubricaci[oó]n|sustituci[oó]n|limpieza|inspecci[oó]n|ajuste|engrase|muestreo|vaciado|apriete)/i.test(
    line,
  )
}

function tipoFromHours(value) {
  const s = cleanLine(value)
  if (!s || COL_HEADER_RE.test(s)) return ''
  if (isHeader(s)) return s.replace(/trabajo\d+$/i, 'trabajo')
  if (/^\d{1,6}(?:[.\s]\d{3})*$/.test(s)) {
    const n = Number(s.replace(/[.\s]/g, ''))
    if (!n) return ''
    if (n >= 10000) return `${n.toLocaleString('es-CL')} km`
    if (n === 10) return 'Cada 10 horas o diariamente'
    if (n === 100) return 'Mantenimiento inicial — 100 horas de trabajo'
    return `Cada ${n} horas de trabajo`
  }
  if (/^\d+[.\s]?\d*\s*(h|hrs?|horas?|km)\b/i.test(s)) {
    return isHeader(`Cada ${s}`) ? `Cada ${s}` : `Cada ${s}`
  }
  return s
}

export function parsePautaText(raw) {
  const text = String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/□/g, '\n□ ')
  const cut = text.split(/\nPiezas requeridas\b/i)[0]
  const lines = cut
    .split('\n')
    .map((l) => cleanLine(l))
    .filter(Boolean)
    .filter((l) => !NOISE_RE.test(l) && !STOP_RE.test(l))

  const tipos = []
  let current = null

  function ensureTipo(nombre) {
    const name = cleanLine(nombre).replace(/(\d)\s*$/, '$1').replace(/trabajo\d+$/i, 'trabajo')
    if (!name) return
    current = tipos.find((t) => t.nombre.toLowerCase() === name.toLowerCase())
    if (!current) {
      current = { id: slugId(), nombre: name, items: [] }
      tipos.push(current)
    }
  }

  function addItem(label) {
    const textLabel = cleanLine(label)
    if (!textLabel || textLabel.length < 4) return
    if (!current) return
    const last = current.items[current.items.length - 1]
    if (
      last &&
      !looksLikeTask(textLabel) &&
      (textLabel.startsWith('(') ||
        /^(de la|de los|del |si existe)/i.test(textLabel) ||
        textLabel.length < 28)
    ) {
      last.label = `${last.label} ${textLabel}`.replace(/\s+/g, ' ').trim()
      return
    }
    if (current.items.some((i) => i.label.toLowerCase() === textLabel.toLowerCase())) return
    current.items.push({ id: slugId(), label: textLabel })
  }

  for (const line of lines) {
    if (isHeader(line)) {
      ensureTipo(line)
      continue
    }
    if (TITLE_RE.test(line)) continue
    addItem(line)
  }

  return tipos.filter((t) => t.items.length)
}

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return parsePautaText(result.text || '')
  } finally {
    try {
      await parser.destroy()
    } catch {
      // ignore worker shutdown errors
    }
  }
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const tipos = []
  let current = null

  function ensureTipo(nombre) {
    const name = cleanLine(nombre)
    if (!name) return
    current = tipos.find((t) => t.nombre.toLowerCase() === name.toLowerCase())
    if (!current) {
      current = { id: slugId(), nombre: name, items: [] }
      tipos.push(current)
    }
  }

  for (const row of rows) {
    const cells = (row || []).map((c) => cleanLine(c)).filter(Boolean)
    if (!cells.length) continue
    if (cells.every((c) => COL_HEADER_RE.test(c))) continue
    if (TITLE_RE.test(cells[0]) && cells.length === 1) continue

    if (cells.length === 1) {
      if (isHeader(cells[0])) ensureTipo(cells[0])
      else {
        const asTipo = tipoFromHours(cells[0])
        if (asTipo && isHeader(asTipo)) ensureTipo(asTipo)
        else {
          if (!current) ensureTipo('Pauta')
          current.items.push({ id: slugId(), label: cells[0] })
        }
      }
      continue
    }

    const first = cells[0]
    const rest = cells.slice(1).join(' — ')
    if (isHeader(rest) && !isHeader(first) && (looksLikeTask(first) || first.length > 12)) {
      ensureTipo(rest)
      current.items.push({ id: slugId(), label: first })
      continue
    }

    const restAsTipo = tipoFromHours(rest)
    if (
      !isHeader(first) &&
      restAsTipo &&
      (isHeader(rest) || isHeader(restAsTipo) || /^\d{1,6}(?:[.\s]\d{3})*$/.test(rest))
    ) {
      ensureTipo(isHeader(rest) ? rest : restAsTipo)
      current.items.push({ id: slugId(), label: first })
      continue
    }

    if (isHeader(first) && !rest) {
      ensureTipo(first)
      continue
    }

    const tipo = tipoFromHours(first) || first
    ensureTipo(tipo)
    if (rest && !COL_HEADER_RE.test(rest)) {
      current.items.push({ id: slugId(), label: rest })
    }
  }

  return tipos.filter((t) => t.items.length)
}

export function pautaSummary(pauta) {
  const tipos = Array.isArray(pauta) ? pauta : []
  return {
    tipos: tipos.length,
    items: tipos.reduce((sum, tipo) => sum + (tipo.items?.length || 0), 0),
  }
}

export async function parsePautaFile(file) {
  const buffer = file?.buffer || null
  if (!buffer) return []
  if (!isPautaFile(file)) throw new Error('Solo se permiten PDF o Excel')

  const name = String(file?.originalname || '')
  const mime = String(file?.mimetype || '')
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name)

  if (isPdf) return parsePdf(buffer)
  return parseExcel(buffer)
}
