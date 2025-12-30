require('dotenv').config()
const express = require('express')
const { getRoster } = require('./script')

const app = express()

function localISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(date)
}

function arrayToObject(data = []) {
  const obj = {}
  for (const day of data) {
    if (day && day.date) obj[day.date] = day
  }
  return obj
}

function applyQueryFilters(data = [], query = {}) {
  let out = Array.isArray(data) ? data.slice() : []

  if (query.only === 'assigned' || query.only === 'shifts') {
    out = out.filter(d => d.hasassignment)
  }

  if (query.only === 'today') {
    const today = localISO()
    out = out.filter(d => d.date === today)
  }

  if (query.from) out = out.filter(d => d.date >= query.from)
  if (query.to) out = out.filter(d => d.date <= query.to)

  if (query.days) {
    const days = Number(query.days)
    if (!Number.isNaN(days)) {
      const startIso = localISO(new Date())
      const end = new Date()
      end.setDate(end.getDate() + days)
      const endIso = localISO(end)
      out = out.filter(d => d.date >= startIso && d.date <= endIso)
    }
  }

  return out
}

app.get('/rooster', async (req, res) => {
  try {
    const data = await getRoster()
    if (Array.isArray(data) && data.length === 0) {
      return res.status(401).json({ error: 'SESSID VERLOPEN' })
    }

    const filtered = applyQueryFilters(data, req.query)
    const format = (req.query.format || 'object').toLowerCase()

    if (format === 'array') return res.json(filtered)
    res.json(arrayToObject(filtered))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/shifts', async (req, res) => {
  try {
    const data = await getRoster()
    if (Array.isArray(data) && data.length === 0) {
      return res.status(401).json({ error: 'SESSID VERLOPEN' })
    }

    const assigned = data.filter(d => d.hasassignment)
    const filtered = applyQueryFilters(assigned, req.query)
    const format = (req.query.format || 'object').toLowerCase()

    if (format === 'array') return res.json(filtered)

    if (format === 'string') {
      const daysStrings = filtered.map(d => {
        const times = (d.assignments || []).map(a => {
          const raw = (a.time || '').toString()
          const cleaned = raw.replace(/\s+/g, '').replace(/[,\|]/g, '-')
          return cleaned
        }).filter(Boolean)
        if (times.length === 0) return d.date
        return [d.date, ...times].join(',')
      })
      const out = daysStrings.join('|')
      return res.type('text/plain').send(out)
    }

    res.json(arrayToObject(filtered))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`API running on PORT ${PORT}`))
