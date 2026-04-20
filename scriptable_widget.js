// Planning Widget - Scriptable
// Paramètre widget: "1" = semaine courante, "2" = semaine suivante

const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"
const REFRESH_INTERVAL = 60 * 60 * 1000 // 1 heure

const MONTHS_EN = ["january","february","march","april","may","june",
                   "july","august","september","october","november","december"]
const DAYS_FR = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"]

const dateCache = {}

function parseDate(dateStr) {
  if (dateCache[dateStr]) return dateCache[dateStr]

  const parts = dateStr.toLowerCase().split(" ")
  if (parts.length < 2) return null
  const day = parseInt(parts[0])
  const monthIdx = MONTHS_EN.indexOf(parts[1])
  if (monthIdx < 0) return null
  const d = new Date(new Date().getFullYear(), monthIdx, day)
  const result = { day, monthIdx, dayIdx: d.getDay(), dayName: DAYS_FR[d.getDay()] }
  dateCache[dateStr] = result
  return result
}

async function main() {
  const weekOffset = parseInt(args.widgetParameter) === 2 ? 1 : 0
  const data = await fetchData()
  const family = config.widgetFamily || "medium"
  const widget = data ? build(data, family, weekOffset) : buildError()

  widget.refreshAfterDate = new Date(Date.now() + REFRESH_INTERVAL)
  widget.url = "https://wiscod.github.io/Planning-semaine/"
  Script.setWidget(widget)

  if (config.runsInWidget) Script.complete()
  else if (family === "small") await widget.presentSmall()
  else if (family === "large") await widget.presentLarge()
  else await widget.presentMedium()
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


function buildError() {
  const w = new ListWidget()
  w.setPadding(12, 14, 12, 14)
  const t = w.addText("Erreur réseau")
  t.font = Font.systemFont(13)
  return w
}

function build(data, family, weekOffset) {
  const w = new ListWidget()
  w.setPadding(12, 14, 12, 14)

  const currentWeek = getISOWeek()
  const targetWeek = currentWeek + weekOffset
  const weekData = data.weeks[String(targetWeek)]
  const courses = weekData ? weekData.courses : []

  // Header
  const headerRow = w.addStack()
  headerRow.layoutHorizontally()
  const title = headerRow.addText(weekOffset === 0 ? "CETTE SEMAINE" : "SEMAINE PROCHAINE")
  title.font = Font.boldMonospacedSystemFont(9)
  headerRow.addSpacer()
  const wk = headerRow.addText(`S${targetWeek}`)
  wk.font = Font.boldMonospacedSystemFont(9)

  w.addSpacer(2)
  const ts = new Date(data.timestamp)
  const tsStr = ts.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  const updated = w.addText(`maj ${tsStr}`)
  updated.font = Font.regularMonospacedSystemFont(8)
  updated.textOpacity = 0.6

  w.addSpacer(8)

  // Group by day
  const byDay = {}
  const order = []
  for (const c of courses) {
    if (!byDay[c.date]) {
      const p = parseDate(c.date)
      if (!p) continue
      byDay[c.date] = { parsed: p, tasks: [] }
      order.push(c.date)
    }
    byDay[c.date].tasks.push(c)
  }

  if (order.length === 0) {
    const m = w.addText("Pas de cours")
    m.font = Font.systemFont(12)
    return w
  }

  const isSmall = family === "small"
  const isLarge = family === "large"
  const maxDays = isLarge ? 7 : isSmall ? 2 : 4
  const maxTasks = isSmall ? 2 : 3
  const labelW = isSmall ? 52 : 70
  const dayFontSize = isSmall ? 8 : 9
  const taskFontSize = isSmall ? 10 : 11
  const timeFontSize = isSmall ? 9 : 10

  for (const key of order.slice(0, maxDays)) {
    const day = byDay[key]

    // Ligne : colonne jour | colonne cours
    const row = w.addStack()
    row.layoutHorizontally()
    row.spacing = 8

    // Colonne gauche — jour
    const labelCol = row.addStack()
    labelCol.layoutVertically()
    labelCol.size = new Size(labelW, 0)

    const dayName = labelCol.addText(day.parsed.dayName.slice(0, isSmall ? 3 : 4))
    dayName.font = Font.boldMonospacedSystemFont(dayFontSize)
    dayName.lineLimit = 1

    const dayNum = labelCol.addText(String(day.parsed.day))
    dayNum.font = Font.boldSystemFont(isSmall ? 14 : 16)

    // Colonne droite — cours
    const contentCol = row.addStack()
    contentCol.layoutVertically()
    contentCol.spacing = 2

    for (const t of day.tasks.slice(0, maxTasks)) {
      const taskRow = contentCol.addStack()
      taskRow.layoutHorizontally()
      taskRow.spacing = 6

      const dash = taskRow.addText("—")
      dash.font = Font.systemFont(timeFontSize)
      dash.textOpacity = 0.4

      const name = taskRow.addText(t.matiere)
      name.font = Font.systemFont(taskFontSize)
      name.lineLimit = 1
      name.minimumScaleFactor = 0.75
      taskRow.addSpacer()

      const time = taskRow.addText(t.time)
      time.font = Font.regularMonospacedSystemFont(timeFontSize)
      time.textOpacity = 0.7
    }

    if (day.tasks.length > maxTasks) {
      const more = contentCol.addText(`+${day.tasks.length - maxTasks}`)
      more.font = Font.systemFont(9)
      more.textOpacity = 0.5
    }

    w.addSpacer(6)
  }

  return w
}

await main()
