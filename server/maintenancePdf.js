import PDFDocument from 'pdfkit'

const PAGE_W = 595.28
const MARGIN = 36
const CONTENT_W = PAGE_W - MARGIN * 2
const PAGE_BOTTOM = 806

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CL', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch {
    return String(value)
  }
}

function roleLabel(role) {
  const map = {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    mecanico: 'Mecánico',
    operador: 'Operador',
    operador_surtidor: 'Operador surtidor',
  }
  return map[role] || role || '—'
}

function statusLabel(status) {
  if (status === 'assigned' || status === 'pending') return 'Asignado'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completado'
  return 'Asignado'
}

function drawSectionTitle(doc, title, y) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#3c3c3b').text(title, MARGIN, y)
  doc
    .moveTo(MARGIN, y + 13)
    .lineTo(MARGIN + CONTENT_W, y + 13)
    .lineWidth(0.75)
    .strokeColor('#d2143a')
    .stroke()
  return y + 20
}

function drawFieldGrid(doc, fields, y, cols = 3) {
  const colW = CONTENT_W / cols
  const rowH = 24
  fields.forEach((field, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = MARGIN + col * colW
    const fy = y + row * rowH
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#666666').text(field.label, x, fy)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#1f1f1f')
      .text(String(field.value || '—'), x, fy + 10, { width: colW - 10 })
  })
  return y + Math.ceil(fields.length / cols) * rowH + 2
}

const NUM_RADIUS = 10
const NUM_COL = NUM_RADIUS * 2 + 6
const OK_SIZE = 14

function measureTaskRow(doc, label, fontSize, textW) {
  doc.font('Helvetica').fontSize(fontSize)
  const textHeight = doc.heightOfString(label, { width: textW, lineGap: 0 })
  return Math.max(NUM_RADIUS * 2 + 4, textHeight + 8)
}

function drawTaskRow(doc, task, index, y, fontSize, textW) {
  const rowX = MARGIN
  const rowW = CONTENT_W
  const label = String(task?.label || '—').trim()
  const okCol = OK_SIZE + 10
  const textX = rowX + NUM_COL + 2
  const rowH = measureTaskRow(doc, label, fontSize, textW)

  if (index % 2 === 0) {
    doc.rect(rowX, y, rowW, rowH).fill('#f8f9fb')
  }

  doc
    .moveTo(rowX, y + rowH)
    .lineTo(rowX + rowW, y + rowH)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke()

  const midY = y + rowH / 2
  const numCx = rowX + NUM_RADIUS + 4

  doc.circle(numCx, midY, NUM_RADIUS).fill('#3c3c3b')
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#ffffff')
    .text(String(index + 1), numCx - NUM_RADIUS, midY - 5, { width: NUM_RADIUS * 2, align: 'center' })

  doc
    .font('Helvetica')
    .fontSize(fontSize)
    .fillColor('#1f1f1f')
    .text(label, textX, y + 4, { width: textW, lineGap: 0 })

  const boxX = rowX + rowW - okCol + 2
  const boxY = midY - OK_SIZE / 2
  doc
    .rect(boxX, boxY, OK_SIZE, OK_SIZE)
    .lineWidth(0.75)
    .strokeColor('#9ca3af')
    .stroke()

  return y + rowH
}

function drawCompletionFooter(doc, y, maintenance) {
  const mechanicName =
    maintenance?.asignadoNombre || maintenance?.mecanicoNombre || 'Mecánico asignado'

  y += 4
  y = drawSectionTitle(doc, 'Observaciones y cierre', y)

  const boxH = 102
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 4).fillAndStroke('#fafafa', '#e5e7eb')

  const innerX = MARGIN + 10
  const innerW = CONTENT_W - 20

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666').text('Observaciones', innerX, y + 8)

  const obsTop = y + 22
  const obsLines = 2
  const obsLineGap = 14
  for (let i = 0; i < obsLines; i += 1) {
    const lineY = obsTop + obsLineGap * (i + 1)
    doc
      .moveTo(innerX, lineY)
      .lineTo(innerX + innerW, lineY)
      .strokeColor('#d1d5db')
      .lineWidth(0.5)
      .stroke()
  }

  const iy = y + 56

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666').text('Horómetro / Km', innerX, iy)
  doc
    .moveTo(innerX, iy + 16)
    .lineTo(innerX + 120, iy + 16)
    .strokeColor('#cbd5e1')
    .lineWidth(0.75)
    .stroke()

  const fechaX = innerX + 140
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666').text('Fecha cierre', fechaX, iy)
  doc
    .moveTo(fechaX, iy + 16)
    .lineTo(fechaX + 110, iy + 16)
    .strokeColor('#cbd5e1')
    .lineWidth(0.75)
    .stroke()

  const firmaX = innerX + 270
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666').text('Firma del mecánico', firmaX, iy)
  doc
    .moveTo(firmaX, iy + 16)
    .lineTo(firmaX + innerW - 270, iy + 16)
    .strokeColor('#cbd5e1')
    .lineWidth(0.75)
    .stroke()

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#1f1f1f')
    .text(mechanicName, firmaX, iy + 20, { width: innerW - 270 })

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#888888')
    .text(
      `Generado ${formatDate(new Date().toISOString())} · Edox SOINVER`,
      innerX,
      y + boxH - 9,
      { width: innerW, align: 'right' },
    )

  return y + boxH
}

function pickTaskLayout(doc, tareas, startY) {
  const footerReserve = 130
  const available = PAGE_BOTTOM - startY - footerReserve
  const okCol = OK_SIZE + 10
  const textWBase = CONTENT_W - NUM_COL - okCol - 4

  for (const fontSize of [9, 8.5, 8, 7.5]) {
    const textW = textWBase
    const total = tareas.reduce(
      (sum, task) => sum + measureTaskRow(doc, String(task?.label || '—').trim(), fontSize, textW),
      0,
    )
    if (total <= available) {
      return { fontSize, textW, total }
    }
  }

  return { fontSize: 7.5, textW: textWBase, total: available }
}

export function buildMaintenanceAssignmentPdf(maintenance, machine) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const tareas = Array.isArray(maintenance.tareas) ? maintenance.tareas : []
    let y = MARGIN

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#d2143a').text('SOINVER', MARGIN, y)
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#3c3c3b')
      .text('Orden de mantenimiento', MARGIN + 90, y + 2)
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#3c3c3b')
      .text(maintenance.sigla || 'Equipo', MARGIN, y, { width: CONTENT_W, align: 'right' })

    y += 22
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + CONTENT_W, y)
      .strokeColor('#e5e7eb')
      .lineWidth(0.75)
      .stroke()
    y += 8

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666')
    doc.text('Estado', MARGIN, y)
    doc.text('Fecha asignación', MARGIN + 120, y)
    doc.text('Tipo', MARGIN + 320, y)

    doc.font('Helvetica').fontSize(9).fillColor('#1f1f1f')
    doc.text(statusLabel(maintenance.status), MARGIN, y + 10)
    doc.text(formatDate(maintenance.createdAt), MARGIN + 120, y + 10, { width: 180 })
    doc.text(maintenance.tipoMantenimiento || '—', MARGIN + 320, y + 10, { width: CONTENT_W - 320 })

    y += 28
    y = drawSectionTitle(doc, 'Equipo', y)
    y = drawFieldGrid(
      doc,
      [
        { label: 'Sigla', value: maintenance.sigla },
        { label: 'Marca', value: machine?.marca },
        { label: 'Modelo', value: machine?.modelo },
        { label: 'Año', value: machine?.anio },
        { label: 'Categoría', value: machine?.categoria },
        { label: 'N° chasis', value: machine?.numeroChasis },
        { label: 'N° motor', value: machine?.numeroMotor },
        { label: 'Cap. estanque', value: machine?.capacidadEstanque },
      ],
      y,
      4,
    )

    y += 2
    y = drawSectionTitle(doc, 'Asignación', y)
    y = drawFieldGrid(
      doc,
      [
        { label: 'Asignado a', value: maintenance.asignadoNombre || maintenance.mecanicoNombre },
        { label: 'Perfil', value: roleLabel(maintenance.asignadoRole) },
        { label: 'Asignado por', value: maintenance.asignadoPorNombre || '—' },
        ...(maintenance.instrucciones?.trim()
          ? [{ label: 'Instrucciones', value: maintenance.instrucciones }]
          : []),
      ],
      y,
      3,
    )

    y += 2
    y = drawSectionTitle(doc, 'Trabajos a realizar', y)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#666666')
      .text(`${tareas.length} ítem(s) — marque OK al completar`, MARGIN, y)
    y += 14

    if (!tareas.length) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text('Sin ítems en la pauta.', MARGIN, y)
      y += 16
    } else {
      const { fontSize, textW } = pickTaskLayout(doc, tareas, y)
      doc
        .rect(MARGIN, y, CONTENT_W, 1)
        .fill('#e5e7eb')
      tareas.forEach((task, index) => {
        y = drawTaskRow(doc, task, index, y, fontSize, textW)
      })
    }

    drawCompletionFooter(doc, y, maintenance)

    doc.end()
  })
}

export function maintenancePdfFilename(maintenance) {
  const sigla = String(maintenance?.sigla || 'equipo').replace(/[^\w.-]+/g, '_')
  const date = new Date(maintenance?.createdAt || Date.now()).toISOString().slice(0, 10)
  return `mantenimiento-${sigla}-${date}.pdf`
}
