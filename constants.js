// Constantes partagées — source unique de vérité

const MONTHS_EN = ["january","february","march","april","may","june",
                   "july","august","september","october","november","december"]
const MONTHS_FR = ["JANVIER","FÉVRIER","MARS","AVRIL","MAI","JUIN",
                   "JUILLET","AOÛT","SEPTEMBRE","OCTOBRE","NOVEMBRE","DÉCEMBRE"]
const DAYS_FR = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"]

// Cache de parsing (évite parseDate répété)
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

function generateJoursMap() {
  // Génère la map jour/date dynamiquement à partir des données
  // Utilisé en Python et JS
  const map = {}
  const now = new Date()
  const year = now.getFullYear()

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dateKey = `${day} ${MONTHS_EN[month]}`
      const dayName = DAYS_FR[d.getDay()]
      map[dateKey] = `${dayName} ${day} ${MONTHS_FR[month]}`
    }
  }
  return map
}
