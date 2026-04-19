// Planning Widget - Scriptable
// Copier ce script dans l'app Scriptable

const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"
const PURPLE = new Color("#764ba2")
const BLUE = new Color("#667eea")
const LIGHT_PURPLE = new Color("#f0ebf8")

async function loadPlanning() {
  try {
    const req = new Request(JSON_URL)
    return await req.loadJSON()
  } catch (e) {
    return null
  }
}

function getCurrentWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now - start
  const oneWeek = 604800000
  return Math.ceil((diff / oneWeek) + start.getDay() / 7)
}

function getTodayCourses(data) {
  const now = new Date()
  const weekNum = getCurrentWeekNumber()
  const weekData = data.weeks[String(weekNum)]
  if (!weekData) return []

  const monthNames = ["january","february","march","april","may","june",
                      "july","august","september","october","november","december"]
  const todayStr = `${now.getDate()} ${monthNames[now.getMonth()]}`

  return weekData.courses.filter(c => c.date.toLowerCase() === todayStr)
}

function getWeekCourses(data) {
  const weekNum = getCurrentWeekNumber()
  const weekData = data.weeks[String(weekNum)]
  return weekData ? weekData.courses : []
}

function buildSmallWidget(courses, timestamp) {
  const widget = new ListWidget()
  widget.backgroundGradient = makeGradient()
  widget.setPadding(12, 12, 12, 12)

  const title = widget.addText("📅 Planning")
  title.font = Font.boldSystemFont(13)
  title.textColor = Color.white()

  widget.addSpacer(4)

  if (courses.length === 0) {
    const msg = widget.addText("Pas de cours aujourd'hui ✅")
    msg.font = Font.systemFont(11)
    msg.textColor = new Color("#ffffff", 0.8)
  } else {
    const max = Math.min(courses.length, 3)
    for (let i = 0; i < max; i++) {
      const c = courses[i]
      const row = widget.addStack()
      row.layoutHorizontally()
      row.spacing = 4

      const time = row.addText(c.time)
      time.font = Font.boldSystemFont(11)
      time.textColor = new Color("#ffe066")

      const name = row.addText(c.matiere)
      name.font = Font.systemFont(11)
      name.textColor = Color.white()
      name.lineLimit = 1
      widget.addSpacer(2)
    }
    if (courses.length > 3) {
      const more = widget.addText(`+${courses.length - 3} autres`)
      more.font = Font.systemFont(10)
      more.textColor = new Color("#ffffff", 0.6)
    }
  }

  widget.addSpacer()
  const ts = widget.addText(formatTimestamp(timestamp))
  ts.font = Font.systemFont(9)
  ts.textColor = new Color("#ffffff", 0.5)

  return widget
}

function buildMediumWidget(courses, weekCourses, timestamp) {
  const widget = new ListWidget()
  widget.backgroundGradient = makeGradient()
  widget.setPadding(14, 16, 14, 16)

  // Header
  const header = widget.addStack()
  header.layoutHorizontally()
  const title = header.addText("📅 VOTRE PLANNING")
  title.font = Font.boldSystemFont(14)
  title.textColor = Color.white()
  header.addSpacer()
  const ts = header.addText(formatTimestamp(timestamp))
  ts.font = Font.systemFont(10)
  ts.textColor = new Color("#ffffff", 0.6)

  widget.addSpacer(8)

  // Aujourd'hui
  const todayLabel = widget.addText("AUJOURD'HUI")
  todayLabel.font = Font.boldSystemFont(10)
  todayLabel.textColor = new Color("#ffe066")

  widget.addSpacer(4)

  if (courses.length === 0) {
    const msg = widget.addText("Pas de cours ✅")
    msg.font = Font.systemFont(12)
    msg.textColor = Color.white()
  } else {
    const max = Math.min(courses.length, 4)
    for (let i = 0; i < max; i++) {
      const c = courses[i]
      const row = widget.addStack()
      row.layoutHorizontally()
      row.spacing = 8

      const time = row.addText(c.time)
      time.font = Font.boldSystemFont(12)
      time.textColor = new Color("#ffe066")
      time.minimumScaleFactor = 0.8

      const name = row.addText(c.matiere)
      name.font = Font.systemFont(12)
      name.textColor = Color.white()
      name.lineLimit = 1

      widget.addSpacer(3)
    }
  }

  return widget
}

function buildLargeWidget(data, timestamp) {
  const widget = new ListWidget()
  widget.backgroundGradient = makeGradient()
  widget.setPadding(16, 16, 16, 16)

  const title = widget.addText("📅 VOTRE PLANNING")
  title.font = Font.boldSystemFont(16)
  title.textColor = Color.white()

  const ts = widget.addText("⏰ " + formatTimestamp(timestamp))
  ts.font = Font.systemFont(10)
  ts.textColor = new Color("#ffffff", 0.6)

  widget.addSpacer(10)

  const weekNum = getCurrentWeekNumber()
  const weekData = data.weeks[String(weekNum)]

  if (!weekData || weekData.courses.length === 0) {
    const msg = widget.addText("Pas de cours cette semaine")
    msg.font = Font.systemFont(13)
    msg.textColor = Color.white()
    return widget
  }

  let currentDay = null
  let count = 0

  for (const course of weekData.courses) {
    if (count >= 10) break

    if (course.date !== currentDay) {
      currentDay = course.date
      widget.addSpacer(6)
      const dayLabel = widget.addText("✨ " + course.date.toUpperCase())
      dayLabel.font = Font.boldSystemFont(11)
      dayLabel.textColor = new Color("#ffe066")
    }

    const row = widget.addStack()
    row.layoutHorizontally()
    row.spacing = 8

    const time = row.addText(course.time)
    time.font = Font.boldSystemFont(12)
    time.textColor = Color.white()

    const name = row.addText(course.matiere)
    name.font = Font.systemFont(12)
    name.textColor = new Color("#ffffff", 0.9)
    name.lineLimit = 1

    widget.addSpacer(2)
    count++
  }

  return widget
}

function makeGradient() {
  const gradient = new LinearGradient()
  gradient.colors = [BLUE, PURPLE]
  gradient.locations = [0, 1]
  gradient.startPoint = new Point(0, 0)
  gradient.endPoint = new Point(1, 1)
  return gradient
}

function formatTimestamp(ts) {
  const d = new Date(ts)
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit"
  })
}

// Main
const data = await loadPlanning()

if (!data) {
  const widget = new ListWidget()
  widget.backgroundGradient = makeGradient()
  const err = widget.addText("❌ Planning indisponible")
  err.textColor = Color.white()
  Script.setWidget(widget)
  Script.complete()
} else {
  const todayCourses = getTodayCourses(data)
  const weekCourses = getWeekCourses(data)
  const family = config.widgetFamily

  let widget
  if (family === "small") {
    widget = buildSmallWidget(todayCourses, data.timestamp)
  } else if (family === "large") {
    widget = buildLargeWidget(data, data.timestamp)
  } else {
    widget = buildMediumWidget(todayCourses, weekCourses, data.timestamp)
  }

  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)
  Script.setWidget(widget)
  Script.complete()
}
