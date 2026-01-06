require('dotenv').config()
const http2 = require('http2')
const zlib = require('zlib')
const cheerio = require('cheerio')

async function decompress(raw, enc = '') {
  if (!enc) return raw
  if (enc.includes('br')) return await new Promise((r, j) => zlib.brotliDecompress(raw, (e, d) => e ? j(e) : r(d)))
  if (enc.includes('gzip')) return await new Promise((r, j) => zlib.gunzip(raw, (e, d) => e ? j(e) : r(d)))
  if (enc.includes('deflate')) return await new Promise((r, j) => zlib.inflate(raw, (e, d) => e ? j(e) : r(d)))
  return raw
}

function parseSetCookie(headers = {}) {
  const sc = headers['set-cookie'] || headers['set-cookie'.toLowerCase()] || []
  const out = []
  if (Array.isArray(sc)) for (const c of sc) { const s = c.toString().split(';')[0].trim(); if (s) out.push(s) }
  else if (sc) { const s = sc.toString().split(';')[0].trim(); if (s) out.push(s) }
  return out
}

async function http2Request(path, method = 'GET', headers = {}, body = null) {
  const client = http2.connect('https://app.planning.nu')
  return new Promise((resolve, reject) => {
    const req = client.request(Object.assign({ ':method': method, ':path': path, ':authority': 'app.planning.nu' }, headers))
    if (body) req.write(body)
    const chunks = []
    let respHeaders = {}
    req.on('response', h => respHeaders = h)
    req.on('data', d => chunks.push(d))
    req.on('end', async () => {
      client.close()
      try {
        const raw = Buffer.concat(chunks)
        const enc = (respHeaders['content-encoding'] || '').toString()
        const buf = await decompress(raw, enc)
        resolve({ headers: respHeaders, body: buf })
      } catch (e) { reject(e) }
    })
    req.on('error', e => { client.close(); reject(e) })
    req.end()
  })
}

function findCookie(jar = [], name) {
  return jar.find(c => c.startsWith(`${name}=`)) || null
}

function looksLikeLoginPage(html = '') {
  const low = html.toLowerCase()
  return low.includes('inloggen') || low.includes('login') || low.includes('wachtwoord') || low.includes('gebruikersnaam') || low.includes('authenticate')
}

async function loginAndGetJar() {
  const EMAIL = process.env.EMAIL
  const PASSWORD = process.env.PASSWORD
  if (!EMAIL || !PASSWORD) throw new Error('Missing EMAIL or PASSWORD in .env')
  const loginPath = process.env.LOGINPATH || '/diegrenze/login'
  const getRes = await http2Request(loginPath, 'GET', { accept: 'text/html' })
  const initialJar = parseSetCookie(getRes.headers)
  const html = getRes.body.toString()
  let csrf = null
  const m1 = html.match(/<meta[^>]*name=["']?csrf-token["']?[^>]*content=["']([^"']+)["']/i)
  if (m1) csrf = m1[1]
  if (!csrf) {
    const m2 = html.match(/<input[^>]*name=["']?_?csrf[_-]?token?["']?[^>]*value=["']([^"']+)["']/i)
    if (m2) csrf = m2[1]
  }
  const authPath = loginPath.replace(/\/$/, '') + '/authenticate'
  const body = JSON.stringify({ username: EMAIL, password: PASSWORD, authenticatorCode: '', rememberDevice: false })
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/plain, */*', cookie: initialJar.join('; ') }
  if (csrf) headers['x-authentication-csrf-token'] = csrf
  const postRes = await http2Request(authPath, 'POST', headers, body)
  const postJar = parseSetCookie(postRes.headers)
  return Array.from(new Set([...initialJar, ...postJar]))
}

async function fetchRosterWithJar(jar) {
  const cookieHeader = jar.join('; ')
  const res = await http2Request(process.env.HEADERPATH, 'GET', { cookie: cookieHeader, accept: 'text/html', 'accept-encoding': 'gzip, deflate, br' })
  const html = res.body.toString()
  const $ = cheerio.load(html)
  const days = []
  const weekday = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  const weekdayFull = { ma: 'maandag', di: 'dinsdag', wo: 'woensdag', do: 'donderdag', vr: 'vrijdag', za: 'zaterdag', zo: 'zondag' }
  $('td[title]').each((i, el) => {
    const date = $(el).attr('title')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const d = new Date(date)
    const wd = weekday[d.getDay()]
    const ass = []
    $(el).find('.ass').each((j, a) => {
      const t = $(a)
      let place = t.find('div[title]').attr('title') || t.find('div[title]').text() || null
      place = place ? place.replace(/\s*>\s*/g, ', ').trim() : null
      const time = t.find('b').first().text().trim() || null
      const txt = t.text()
      const pm = txt.match(/\(([^)]*pauze[^)]*)\)/i) || txt.match(/\((\d+\s*min[^)]*)\)/i)
      const pause = pm ? pm[1].trim() : null
      ass.push({ place, time, pause })
    })
    days.push({ date, weekday: wd, weekday_full: weekdayFull[wd], assignments: ass, hasassignment: ass.length > 0 })
  })
  return { days, html, headers: res.headers }
}

async function getRoster() {
  if (!process.env.HEADERPATH) throw new Error('Missing HEADERPATH in .env')
  let jar = []
  let usedEnv = false
  if (process.env.PHPSESSID) { jar = [`PHPSESSID=${process.env.PHPSESSID}`]; usedEnv = true }
  else if (process.env.EMAIL && process.env.PASSWORD) {
    jar = await loginAndGetJar()
  } else throw new Error('Provide either PHPSESSID or EMAIL+PASSWORD in .env')

  let attempt = await fetchRosterWithJar(jar)
  if ((!attempt.days || attempt.days.length === 0) && looksLikeLoginPage(attempt.html)) {
    if (usedEnv && process.env.EMAIL && process.env.PASSWORD) {
      try {
        jar = await loginAndGetJar()
        attempt = await fetchRosterWithJar(jar)
      } catch (e) {
        const hasPHP = Boolean(findCookie(jar, 'PHPSESSID'))
        const snippet = (attempt.html || '').slice(0, 1000).replace(/\s+/g, ' ')
        throw { error: 'SESSID_VERLOPEN_AUTOREFRESH_FAILED', message: e.message, phpSessionPresent: hasPHP, snippet }
      }
    } else {
      const hasPHP = Boolean(findCookie(jar, 'PHPSESSID'))
      const snippet = (attempt.html || '').slice(0, 1000).replace(/\s+/g, ' ')
      throw { error: 'LOGIN_DETECTED', message: 'Login page returned. Check credentials or 2FA.', phpSessionPresent: hasPHP, snippet }
    }
  }

  if (!attempt.days || attempt.days.length === 0) {
    const hasPHP = Boolean(findCookie(jar, 'PHPSESSID'))
    const snippet = (attempt.html || '').slice(0, 1000).replace(/\s+/g, ' ')
    throw { error: 'NO_DATA', message: 'No days parsed from page', phpSessionPresent: hasPHP, snippet }
  }

  return attempt.days
}

module.exports = { getRoster }

if (require.main === module) {
  (async () => {
    try {
      const data = await getRoster()
      console.log(JSON.stringify({ ok: true, count: data.length, data }, null, 2))
      process.exit(0)
    } catch (e) {
      if (e && typeof e === 'object') console.error(JSON.stringify({ ok: false, error: e }, null, 2))
      else console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2))
      process.exit(1)
    }
  })()
}
