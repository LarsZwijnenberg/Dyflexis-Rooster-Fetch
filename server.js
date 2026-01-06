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

function formatDaysToString(days = []) {
  const dayStrings = days.map(d => {
    const times = (d.assignments || [])
      .map(a => (a.time || '').toString()
        .replace(/\s+/g, '')
        .replace(/[,\|]/g, '-')
      )
      .filter(Boolean)

    if (times.length === 0) return d.date
    return [d.date, ...times].join(',')
  })

  return dayStrings.join('|')
}

async function handleRosterRequest(req, res, { onlyAssigned = false } = {}) {
  try {
    const data = await getRoster()
    
    const base = onlyAssigned ? data.filter(d => d.hasassignment) : data
    const filtered = applyQueryFilters(base, req.query)
    const format = (req.query.format || 'object').toLowerCase()

    if (format === 'array') return res.json(filtered)
    if (format === 'string') {
      return res.type('text/plain').send(formatDaysToString(filtered))
    }

    res.json(arrayToObject(filtered))
  } catch (e) {
    console.error('Error fetching roster:', e)
    
    if (e && e.error === 'LOGIN_FAILED') {
      return res.status(401).json({ error: 'LOGIN_FAILED', message: e.message })
    }
    
    res.status(500).json({ error: e.message || 'Unknown error' })
  }
}

app.get('/rooster', (req, res) => handleRosterRequest(req, res))
app.get('/shifts', (req, res) => handleRosterRequest(req, res, { onlyAssigned: true }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`API running on PORT ${PORT}`))