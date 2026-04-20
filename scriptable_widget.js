// Planning Widget - Scriptable (texte pur, compatible mode transparent iOS)
// Paramètre widget: "1" = semaine courante, "2" = semaine suivante
const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"

const MONTHS_EN = ["january","february","march","april","may","june",
                   "july","august","september","october","november","december"]
const DAYS_FR = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"]

async function main() {
  const weekOffset = parseInt(args.widgetParameter) === 2 ? 1 : 0
  const data = await fetchData()
  const family = config.widgetFamily || "medium"
  const widget = data ? build(data, family, weekOffset) : buildError()

  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)
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

function parseDate(dateStr) {
  const parts = dateStr.toLowerCase().split(" ")
  if (parts.length < 2) return null
  const day = parseInt(parts[0])
  const monthIdx = MONTHS_EN.indexOf(parts[1])
  if (monthIdx < 0) return null
  const d = new Date(new Date().getFullYear(), monthIdx, day)
  return { day, dayIdx: d.getDay(), dayName: DAYS_FR[d.getDay()] }
}

function buildError() {
  const w = new ListWidget()
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
  const header = w.addStack()
  header.layoutHorizontally()
  const title = header.addText(weekOffset === 0 ? "CETTE SEMAINE" : "SEMAINE PROCHAINE")
  title.font = Font.boldMonospacedSystemFont(9)
  header.addSpacer()
  const wk = header.addText(`S${targetWeek}`)
  wk.font = Font.boldMonospacedSystemFont(9)

  w.addSpacer(2)
  const ts = new Date(data.timestamp)
  const tsStr = ts.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  })
  const updated = w.addText(`maj ${tsStr}`)
  updated.font = Font.monospacedSystemFont(8)
  updated.textOpacity = 0.6

  w.addSpacer(8)

  // Group by day
  const byDay = {}
  const order = []
  for (const c of courses) {
    const p = parseDate(c.date)
    if (!p) continue
    if (!byDay[c.date]) { byDay[c.date] = { parsed: p, tasks: [] }; order.push(c.date) }
    byDay[c.date].tasks.push(c)
  }

  if (order.length === 0) {
    const m = w.addText("Pas de cours")
    m.font = Font.systemFont(12)
    return w
  }

  const maxDays = family === "large" ? 7 : family === "small" ? 2 : 4
  const maxTasksPerDay = family === "small" ? 2 : 3
  const dayFont = family === "small" ? 9 : 10
  const taskFont = family === "small" ? 10 : 12
  const timeFont = family === "small" ? 9 : 10

  for (const key of order.slice(0, maxDays)) {
    const day = byDay[key]

    const dayLabel = w.addText(`${day.parsed.dayName} ${day.parsed.day}`)
    dayLabel.font = Font.boldMonospacedSystemFont(dayFont)

    w.addSpacer(3)

    for (const t of day.tasks.slice(0, maxTasksPerDay)) {
      const row = w.addStack()
      row.layoutHorizontally()
      row.spacing = 8

      const time = row.addText(t.time)
      time.font = Font.monospacedSystemFont(timeFont)

      const name = row.addText(t.matiere)
      name.font = Font.systemFont(taskFont)
      name.lineLimit = 1
      name.minimumScaleFactor = 0.7

      row.addSpacer()

      w.addSpacer(2)
    }

    if (day.tasks.length > maxTasksPerDay) {
      const more = w.addText(`  +${day.tasks.length - maxTasksPerDay}`)
      more.font = Font.systemFont(9)
    }

    w.addSpacer(6)
  }

  return w
}

await main()
