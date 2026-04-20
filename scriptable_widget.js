// Planning Widget - Scriptable
// Paramètre widget: "1" = semaine courante, "2" = semaine suivante
const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"

const MONTHS_EN = ["january","february","march","april","may","june",
                   "july","august","september","october","november","december"]
const MONTHS_FR = ["janvier","février","mars","avril","mai","juin",
                   "juillet","août","septembre","octobre","novembre","décembre"]
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
  const widget = data ? buildWidget(data, family, weekOffset) : buildErrorWidget("Erreur réseau")

  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)
  Script.setWidget(widget)

  if (config.runsInWidget) {
    Script.complete()
  } else if (family === "small") {
    await widget.presentSmall()
  } else if (family === "large") {
    await widget.presentLarge()
  } else {
    await widget.presentMedium()
  }
}

async function fetchData() {
  try {
    const req = new Request(JSON_URL)
    req.timeoutInterval = 10
    return await req.loadJSON()
  } catch (e) {
    return null
  }
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

function isWeekend(dayIdx) {
  return dayIdx === 0 || dayIdx === 6
}

function buildErrorWidget(msg) {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(14, 14, 14, 14)
  const t = w.addText("Erreur: " + msg)
  t.textColor = TEXT_DARK
  t.font = Font.systemFont(13)
  return w
}

function buildWidget(data, family, weekOffset) {
  const w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(12, 12, 12, 12)
  w.url = "https://wiscod.github.io/Planning-semaine/"

  const currentWeek = getISOWeek()
  const targetWeek = currentWeek + weekOffset
  const weekData = data.weeks[String(targetWeek)]
  const allCourses = weekData ? weekData.courses : []

  // Header
  const title = w.addText(weekOffset === 0 ? "CETTE SEMAINE" : "SEMAINE PROCHAINE")
  title.font = new Font("Menlo-Bold", 9)
  title.textColor = TEXT_MUTED

  w.addSpacer(2)
  const subtitle = w.addText(`Semaine ${targetWeek}`)
  subtitle.font = Font.boldSystemFont(15)
  subtitle.textColor = TEXT_DARK
  w.addSpacer(8)

  // Group by day
  const byDay = {}
  const order = []
  for (const c of allCourses) {
    const p = parseDate(c.date)
    if (!p) continue
    if (!byDay[c.date]) {
      byDay[c.date] = { parsed: p, tasks: [] }
      order.push(c.date)
    }
    byDay[c.date].tasks.push(c)
  }

  if (order.length === 0) {
    const m = w.addText("Pas de cours")
    m.font = Font.systemFont(12)
    m.textColor = TEXT_MUTED
    return w
  }

  const max = family === "large" ? 7 : family === "small" ? 2 : 4
  const shown = order.slice(0, max)

  for (const key of shown) {
    addDayRow(w, byDay[key], family)
    w.addSpacer(2)
  }

  return w
}

function addDayRow(w, day, family) {
  const row = w.addStack()
  row.layoutHorizontally()
  row.spacing = 0
  row.cornerRadius = 4

  // Day label (colored column)
  const label = row.addStack()
  label.backgroundColor = isWeekend(day.parsed.dayIdx) ? PURPLE : BLUE
  label.setPadding(6, 8, 6, 8)
  label.size = new Size(family === "small" ? 52 : 64, 0)
  label.layoutVertically()
  const dn = label.addText(day.parsed.dayName.toUpperCase())
  dn.font = new Font("Menlo-Bold", 8)
  dn.textColor = Color.white()
  const dd = label.addText(String(day.parsed.day))
  dd.font = Font.boldSystemFont(family === "small" ? 11 : 13)
  dd.textColor = Color.white()

  // Content column
  const content = row.addStack()
  content.backgroundColor = CARD_BG
  content.setPadding(6, 10, 6, 10)
  content.layoutVertically()
  content.spacing = 2

  const maxTasks = family === "small" ? 2 : family === "large" ? 5 : 3
  for (const t of day.tasks.slice(0, maxTasks)) {
    const tRow = content.addStack()
    tRow.layoutHorizontally()
    tRow.spacing = 6

    const dash = tRow.addText("—")
    dash.font = Font.systemFont(10)
    dash.textColor = TEXT_FAINT

    const name = tRow.addText(t.matiere)
    name.font = Font.systemFont(family === "small" ? 10 : 12)
    name.textColor = TEXT_DARK
    name.lineLimit = 1
    name.minimumScaleFactor = 0.7

    tRow.addSpacer()

    const time = tRow.addText(t.time)
    time.font = new Font("Menlo", family === "small" ? 8 : 9)
    time.textColor = TEXT_MUTED
  }

  if (day.tasks.length > maxTasks) {
    const more = content.addText(`+${day.tasks.length - maxTasks}`)
    more.font = Font.systemFont(9)
    more.textColor = TEXT_MUTED
  }
}

await main()
