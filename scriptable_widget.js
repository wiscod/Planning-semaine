// Planning Widget - Scriptable
const JSON_URL = "https://wiscod.github.io/Planning-semaine/planning.json"

function getISOWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
}

function getTodayStr() {
  const d = new Date()
  const months = ["january","february","march","april","may","june",
                  "july","august","september","october","november","december"]
  return `${d.getDate()} ${months[d.getMonth()]}`
}

// Charger le JSON
let data
try {
  const req = new Request(JSON_URL)
  data = await req.loadJSON()
} catch(e) {
  const w = new ListWidget()
  w.backgroundColor = new Color("#764ba2")
  const t = w.addText("❌ Erreur réseau")
  t.textColor = Color.white()
  t.font = Font.systemFont(14)
  Script.setWidget(w)
  Script.complete()
  return
}

// Trouver les cours
const weekNum = String(getISOWeek())
const todayStr = getTodayStr()
const weekData = data.weeks[weekNum]
const allCourses = weekData ? weekData.courses : []
const todayCourses = allCourses.filter(c => c.date.toLowerCase() === todayStr)

// Construire le widget
const widget = new ListWidget()
widget.backgroundColor = new Color("#4c3490")
widget.setPadding(14, 14, 14, 14)
widget.url = "https://wiscod.github.io/Planning-semaine/"
widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)

// Titre
const title = widget.addText("📅 PLANNING")
title.font = Font.boldSystemFont(14)
title.textColor = Color.white()
widget.addSpacer(2)

const tsText = widget.addText("⏰ " + formatDate(data.timestamp))
tsText.font = Font.systemFont(10)
tsText.textColor = new Color("#ffffff88")
widget.addSpacer(8)

const family = config.widgetFamily

if (family === "small") {
  // Juste aujourd'hui
  const label = widget.addText("AUJOURD'HUI")
  label.font = Font.boldSystemFont(9)
  label.textColor = new Color("#ffe066")
  widget.addSpacer(4)

  if (todayCourses.length === 0) {
    const m = widget.addText("Pas de cours ✅")
    m.font = Font.systemFont(12)
    m.textColor = Color.white()
  } else {
    for (const c of todayCourses.slice(0, 3)) {
      const row = widget.addStack()
      row.layoutHorizontally()
      row.spacing = 6
      const time = row.addText(c.time)
      time.font = Font.boldSystemFont(11)
      time.textColor = new Color("#ffe066")
      const name = row.addText(c.matiere)
      name.font = Font.systemFont(11)
      name.textColor = Color.white()
      name.lineLimit = 1
      widget.addSpacer(3)
    }
  }

} else {
  // Medium / Large : semaine complète groupée par jour
  if (allCourses.length === 0) {
    const m = widget.addText("Pas de cours cette semaine")
    m.font = Font.systemFont(13)
    m.textColor = Color.white()
  } else {
    let currentDay = null
    let count = 0
    const max = family === "large" ? 12 : 5

    for (const c of allCourses) {
      if (count >= max) break
      if (c.date !== currentDay) {
        currentDay = c.date
        if (count > 0) widget.addSpacer(4)
        const dayLabel = widget.addText("✨ " + c.date.toUpperCase())
        dayLabel.font = Font.boldSystemFont(10)
        dayLabel.textColor = new Color("#ffe066")
        widget.addSpacer(2)
      }
      const row = widget.addStack()
      row.layoutHorizontally()
      row.spacing = 8
      const time = row.addText(c.time)
      time.font = Font.boldSystemFont(12)
      time.textColor = Color.white()
      const name = row.addText(c.matiere)
      name.font = Font.systemFont(12)
      name.textColor = new Color("#ffffffcc")
      name.lineLimit = 1
      widget.addSpacer(2)
      count++
    }
  }
}

Script.setWidget(widget)
Script.complete()
