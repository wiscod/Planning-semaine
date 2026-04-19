// Planning Widget - Scriptable
const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"

async function main() {
  const data = await fetchData()
  const family = config.widgetFamily || "medium"
  const widget = data ? buildWidget(data, family) : buildErrorWidget("Erreur réseau")

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
    console.error("Fetch error: " + e)
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

function getTodayStr() {
  const d = new Date()
  const months = ["january","february","march","april","may","june",
                  "july","august","september","october","november","december"]
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function formatTs(ts) {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit"
  })
}

function buildErrorWidget(msg) {
  const w = new ListWidget()
  w.backgroundColor = new Color("#764ba2")
  w.setPadding(14, 14, 14, 14)
  const t = w.addText("❌ " + msg)
  t.textColor = Color.white()
  t.font = Font.boldSystemFont(13)
  return w
}

function buildWidget(data, family) {
  const w = new ListWidget()
  w.backgroundColor = new Color("#4c3490")
  w.setPadding(14, 14, 14, 14)
  w.url = "https://wiscod.github.io/Planning-semaine/"

  // Titre
  const title = w.addText("📅 PLANNING")
  title.font = Font.boldSystemFont(14)
  title.textColor = Color.white()

  w.addSpacer(2)
  const ts = w.addText("⏰ " + formatTs(data.timestamp))
  ts.font = Font.systemFont(10)
  ts.textColor = new Color("#ffffff88")
  w.addSpacer(8)

  const weekNum = String(getISOWeek())
  const todayStr = getTodayStr()
  const weekData = data.weeks[weekNum]
  const allCourses = weekData ? weekData.courses : []
  const todayCourses = allCourses.filter(c => c.date.toLowerCase() === todayStr)

  if (family === "small") {
    addSmallContent(w, todayCourses)
  } else {
    addWeekContent(w, allCourses, family === "large" ? 12 : 5)
  }

  return w
}

function addSmallContent(w, courses) {
  const label = w.addText("AUJOURD'HUI")
  label.font = Font.boldSystemFont(9)
  label.textColor = new Color("#ffe066")
  w.addSpacer(4)

  if (courses.length === 0) {
    const m = w.addText("Pas de cours ✅")
    m.font = Font.systemFont(12)
    m.textColor = Color.white()
    return
  }

  for (const c of courses.slice(0, 3)) {
    const row = w.addStack()
    row.layoutHorizontally()
    row.spacing = 6

    const time = row.addText(c.time)
    time.font = Font.boldSystemFont(11)
    time.textColor = new Color("#ffe066")

    const name = row.addText(c.matiere)
    name.font = Font.systemFont(11)
    name.textColor = Color.white()
    name.lineLimit = 1

    w.addSpacer(3)
  }
}

function addWeekContent(w, courses, max) {
  if (courses.length === 0) {
    const m = w.addText("Pas de cours cette semaine")
    m.font = Font.systemFont(13)
    m.textColor = Color.white()
    return
  }

  let currentDay = null
  let count = 0

  for (const c of courses) {
    if (count >= max) break

    if (c.date !== currentDay) {
      currentDay = c.date
      if (count > 0) w.addSpacer(4)
      const dayLabel = w.addText("✨ " + c.date.toUpperCase())
      dayLabel.font = Font.boldSystemFont(10)
      dayLabel.textColor = new Color("#ffe066")
      w.addSpacer(2)
    }

    const row = w.addStack()
    row.layoutHorizontally()
    row.spacing = 8

    const time = row.addText(c.time)
    time.font = Font.boldSystemFont(12)
    time.textColor = Color.white()

    const name = row.addText(c.matiere)
    name.font = Font.systemFont(12)
    name.textColor = new Color("#ffffffcc")
    name.lineLimit = 1

    w.addSpacer(2)
    count++
  }
}

await main()
