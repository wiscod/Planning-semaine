// Planning Widget - Scriptable (image-rendered, survit au mode transparent iOS)
// Paramètre widget: "1" = semaine courante, "2" = semaine suivante
const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"

const MONTHS_EN = ["january","february","march","april","may","june",
                   "july","august","september","october","november","december"]
const DAYS_FR = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]

const BG = new Color("#f5f4f0")
const CARD_BG = new Color("#ffffff")
const BORDER = new Color("#ebebeb")
const TEXT_DARK = new Color("#2a2a2a")
const TEXT_MUTED = new Color("#999999")
const TEXT_FAINT = new Color("#bbbbbb")
const BLUE = new Color("#7c9cbf")
const PURPLE = new Color("#9b8ec4")

async function main() {
  const weekOffset = parseInt(args.widgetParameter) === 2 ? 1 : 0
  const data = await fetchData()
  const family = config.widgetFamily || "medium"
  const widget = new ListWidget()
  widget.url = "https://wiscod.github.io/Planning-semaine/"
  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)

  const size = widgetSize(family)
  const img = data ? renderImage(data, weekOffset, size) : renderError(size)
  widget.backgroundImage = img
  widget.backgroundColor = BG

  Script.setWidget(widget)
  if (config.runsInWidget) Script.complete()
  else if (family === "small") await widget.presentSmall()
  else if (family === "large") await widget.presentLarge()
  else await widget.presentMedium()
}

function widgetSize(family) {
  // Tailles approximatives en points ×3 pour la résolution
  if (family === "small") return { w: 465, h: 465 }
  if (family === "large") return { w: 987, h: 1035 }
  return { w: 987, h: 465 }
}

async function fetchData() {
  try {
    const req = new Request(JSON_URL)
    req.timeoutInterval = 10
    return await req.loadJSON()
  } catch (e) { return null }
}

function getISOWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function parseDate(dateStr) {
  const parts = dateStr.toLowerCase().split(" ")
  if (parts.length < 2) return null
  const day = parseInt(parts[0])
  const monthIdx = MONTHS_EN.indexOf(parts[1])
  if (monthIdx < 0) return null
  const d = new Date(new Date().getFullYear(), monthIdx, day)
  return { day, monthIdx, dayIdx: d.getDay(), dayName: DAYS_FR[d.getDay()] }
}

function renderError(size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size.w, size.h)
  ctx.opaque = true
  ctx.respectScreenScale = true
  ctx.setFillColor(BG)
  ctx.fillRect(new Rect(0, 0, size.w, size.h))
  ctx.setTextColor(TEXT_DARK)
  ctx.setFont(Font.systemFont(28))
  ctx.drawText("Erreur réseau", new Point(40, 40))
  return ctx.getImage()
}

function renderImage(data, weekOffset, size) {
  const currentWeek = getISOWeek()
  const targetWeek = currentWeek + weekOffset
  const weekData = data.weeks[String(targetWeek)]
  const courses = weekData ? weekData.courses : []

  const ctx = new DrawContext()
  ctx.size = new Size(size.w, size.h)
  ctx.opaque = true
  ctx.respectScreenScale = true

  // Fond global
  ctx.setFillColor(BG)
  ctx.fillRect(new Rect(0, 0, size.w, size.h))

  const pad = 36
  let y = pad

  // Header
  ctx.setTextColor(TEXT_MUTED)
  ctx.setFont(Font.boldMonospacedSystemFont(22))
  ctx.drawText((weekOffset === 0 ? "CETTE SEMAINE" : "SEMAINE PROCHAINE"), new Point(pad, y))
  y += 30
  ctx.setTextColor(TEXT_DARK)
  ctx.setFont(Font.boldSystemFont(38))
  ctx.drawText(`Semaine ${targetWeek}`, new Point(pad, y))
  y += 56

  // Group by day (date string)
  const byDay = {}
  const order = []
  for (const c of courses) {
    const p = parseDate(c.date)
    if (!p) continue
    if (!byDay[c.date]) { byDay[c.date] = { parsed: p, tasks: [] }; order.push(c.date) }
    byDay[c.date].tasks.push(c)
  }

  if (order.length === 0) {
    ctx.setTextColor(TEXT_MUTED)
    ctx.setFont(Font.systemFont(26))
    ctx.drawText("Pas de cours", new Point(pad, y))
    return ctx.getImage()
  }

  const isSmall = size.w < 600
  const isLarge = size.h > 700
  const maxDays = isLarge ? 7 : isSmall ? 3 : 4
  const contentW = size.w - pad * 2
  const labelW = isSmall ? 90 : 130
  const rowGap = 6
  const rowH = isLarge ? 110 : isSmall ? 80 : 95

  for (const key of order.slice(0, maxDays)) {
    const day = byDay[key]
    drawDayRow(ctx, pad, y, contentW, rowH, labelW, day, isSmall)
    y += rowH + rowGap
    if (y + rowH > size.h - pad) break
  }

  return ctx.getImage()
}

function drawDayRow(ctx, x, y, totalW, h, labelW, day, isSmall) {
  const isWeekend = day.parsed.dayIdx === 0 || day.parsed.dayIdx === 6
  const labelColor = isWeekend ? PURPLE : BLUE
  const radius = 8

  // Label (colonne gauche)
  ctx.setFillColor(labelColor)
  drawRoundedRect(ctx, x, y, labelW, h, radius, "left")

  ctx.setTextColor(Color.white())
  ctx.setFont(Font.boldMonospacedSystemFont(isSmall ? 16 : 19))
  ctx.drawText(day.parsed.dayName.toUpperCase().slice(0, isSmall ? 3 : 8), new Point(x + 12, y + 14))
  ctx.setFont(Font.boldSystemFont(isSmall ? 28 : 34))
  ctx.drawText(String(day.parsed.day), new Point(x + 12, y + (isSmall ? 38 : 42)))

  // Card (colonne droite)
  const cx = x + labelW
  const cw = totalW - labelW
  ctx.setFillColor(CARD_BG)
  drawRoundedRect(ctx, cx, y, cw, h, radius, "right")

  // Tasks
  const maxTasks = isSmall ? 2 : 3
  let ty = y + 14
  const lineH = isSmall ? 26 : 30
  for (const t of day.tasks.slice(0, maxTasks)) {
    ctx.setTextColor(TEXT_FAINT)
    ctx.setFont(Font.systemFont(isSmall ? 16 : 18))
    ctx.drawText("—", new Point(cx + 14, ty))

    ctx.setTextColor(TEXT_DARK)
    ctx.setFont(Font.systemFont(isSmall ? 16 : 19))
    const maxChars = isSmall ? 18 : 30
    const name = t.matiere.length > maxChars ? t.matiere.slice(0, maxChars - 1) + "…" : t.matiere
    ctx.drawText(name, new Point(cx + 36, ty))

    ctx.setTextColor(TEXT_MUTED)
    ctx.setFont(Font.monospacedSystemFont(isSmall ? 13 : 15))
    const timeW = 70
    ctx.drawText(t.time, new Point(cx + cw - timeW - 12, ty + 2))

    ty += lineH
  }
  if (day.tasks.length > maxTasks) {
    ctx.setTextColor(TEXT_MUTED)
    ctx.setFont(Font.systemFont(isSmall ? 13 : 15))
    ctx.drawText(`+${day.tasks.length - maxTasks}`, new Point(cx + 14, ty))
  }
}

function drawRoundedRect(ctx, x, y, w, h, r, side) {
  // side: "left" = coins arrondis à gauche, "right" = à droite, sinon tout
  const path = new Path()
  if (side === "left") {
    path.move(new Point(x + r, y))
    path.addLine(new Point(x + w, y))
    path.addLine(new Point(x + w, y + h))
    path.addLine(new Point(x + r, y + h))
    path.addQuadCurve(new Point(x, y + h - r), new Point(x, y + h))
    path.addLine(new Point(x, y + r))
    path.addQuadCurve(new Point(x + r, y), new Point(x, y))
  } else if (side === "right") {
    path.move(new Point(x, y))
    path.addLine(new Point(x + w - r, y))
    path.addQuadCurve(new Point(x + w, y + r), new Point(x + w, y))
    path.addLine(new Point(x + w, y + h - r))
    path.addQuadCurve(new Point(x + w - r, y + h), new Point(x + w, y + h))
    path.addLine(new Point(x, y + h))
    path.closeSubpath()
  } else {
    path.addRoundedRect(new Rect(x, y, w, h), r, r)
  }
  ctx.addPath(path)
  ctx.fillPath()
}

await main()
