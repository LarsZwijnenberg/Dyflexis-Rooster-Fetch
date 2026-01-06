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
  if (Array.isArray(sc)) {
    for (const c of sc) {
      const s = c.toString().split(';')[0].trim()
      if (s) out.push(s)
    }
  } else if (sc) {
    const s = sc.toString().split(';')[0].trim()
    if (s) out.push(s)
  }
  return out
}

function extractSESSID(cookies = []) {
  for (const cookie of cookies) {
    let match = cookie.match(/^SESSID=([^;]+)/)
    if (match) return match[1]
    
    match = cookie.match(/^PHPSESSID=([^;]+)/)
    if (match) return match[1]
  }
  return null
}

async function http2Request(path, method = 'GET', headers = {}, body = null) {
  console.log(`[HTTP2] ${method} ${path}`)
  const client = http2.connect('https://app.planning.nu')
  return new Promise((resolve, reject) => {
    const req = client.request(Object.assign({
      ':method': method,
      ':path': path,
      ':authority': 'app.planning.nu'
    }, headers))
    
    if (body) req.write(body)
    
    const chunks = []
    let respHeaders = {}
    
    req.on('response', h => {
      respHeaders = h
      console.log(`[HTTP2] Response status: ${h[':status']}`)
    })
    req.on('data', d => chunks.push(d))
    req.on('end', async () => {
      client.close()
      try {
        const raw = Buffer.concat(chunks)
        console.log(`[HTTP2] Received ${raw.length} bytes`)
        const enc = (respHeaders['content-encoding'] || '').toString()
        if (enc) console.log(`[HTTP2] Content-Encoding: ${enc}`)
        const buf = await decompress(raw, enc)
        console.log(`[HTTP2] Decompressed to ${buf.length} bytes`)
        resolve({ headers: respHeaders, body: buf })
      } catch (e) {
        console.error('[HTTP2] Error processing response:', e)
        reject(e)
      }
    })
    req.on('error', e => {
      console.error('[HTTP2] Request error:', e)
      client.close()
      reject(e)
    })
    req.end()
  })
}

function extractCSRF(html) {
  const m1 = html.match(/<meta[^>]*name=["']?authentication-csrf-token["']?[^>]*content=["']([^"']+)["']/i)
  if (m1) return m1[1]
  
  const m2 = html.match(/<meta[^>]*name=["']?csrf-token["']?[^>]*content=["']([^"']+)["']/i)
  if (m2) return m2[1]
  
  const m3 = html.match(/<input[^>]*name=["']?_?csrf[_-]?token?["']?[^>]*value=["']([^"']+)["']/i)
  if (m3) return m3[1]
  
  return null
}

async function loginAndGetSESSID() {
  console.log('[LOGIN] Starting login process...')
  const EMAIL = process.env.EMAIL
  const PASSWORD = process.env.PASSWORD
  if (!EMAIL || !PASSWORD) {
    throw new Error('Missing EMAIL or PASSWORD in .env')
  }

  const loginPath = process.env.LOGINPATH')
  console.log(`[LOGIN] Login path: ${loginPath}`)
  
  const getRes = await http2Request(loginPath, 'GET', { accept: 'text/html' })
  const initialCookies = parseSetCookie(getRes.headers)
  console.log(`[LOGIN] Initial cookies: ${initialCookies.join(', ')}`)
  
  let sessid = extractSESSID(initialCookies)
  if (sessid) console.log(`[LOGIN] Initial SESSID: ${sessid}`)
  
  const html = getRes.body.toString()
  const csrf = extractCSRF(html)
  console.log(`[LOGIN] CSRF token: ${csrf ? csrf : 'not found'}`)

  const authPath = loginPath.replace(/\/$/, '') + '/authenticate'
  console.log(`[LOGIN] Auth path: ${authPath}`)
  
  const body = JSON.stringify({
    username: EMAIL,
    password: PASSWORD,
    authenticatorCode: '',
    rememberDevice: false
  })
  
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/plain, */*',
    cookie: initialCookies.join('; ')
  }
  if (csrf) headers['x-authentication-csrf-token'] = csrf

  const postRes = await http2Request(authPath, 'POST', headers, body)
  console.log(`[LOGIN] Auth response body: ${postRes.body.toString()}`)
  const authCookies = parseSetCookie(postRes.headers)
  console.log(`[LOGIN] Auth cookies: ${authCookies.join(', ')}`)
  
  sessid = extractSESSID(authCookies) || sessid
  
  if (!sessid) {
    throw new Error('No SESSID found after login')
  }
  
  console.log(`[LOGIN] Final SESSID: ${sessid}`)
  return sessid
}

async function fetchRosterWithSESSID(sessid) {
  console.log('[ROSTER] Fetching roster data...')
  console.log(`[ROSTER] Using SESSID: ${sessid}`)
  
  const res = await http2Request(process.env.HEADERPATH, 'GET', {
    cookie: `PHPSESSID=${sessid}`,
    accept: 'text/html',
    'accept-encoding': 'gzip, deflate, br'
  })
  
  const html = res.body.toString()
  console.log(`[ROSTER] HTML length: ${html.length} chars`)
  
  const $ = cheerio.load(html)
  const days = []
  
  const weekday = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  const weekdayFull = {
    ma: 'maandag',
    di: 'dinsdag',
    wo: 'woensdag',
    do: 'donderdag',
    vr: 'vrijdag',
    za: 'zaterdag',
    zo: 'zondag'
  }

  const tdElements = $('td[title]')
  console.log(`[ROSTER] Found ${tdElements.length} td[title] elements`)

  tdElements.each((i, el) => {
    const date = $(el).attr('title')
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const d = new Date(date)
    const wd = weekday[d.getDay()]
    const ass = []

    const assElements = $(el).find('.ass')

    assElements.each((j, a) => {
      const t = $(a)
      let place = t.find('div[title]').attr('title') || t.find('div[title]').text() || null
      place = place ? place.replace(/\s*>\s*/g, ', ').trim() : null
      
      const time = t.find('b').first().text().trim() || null
      const txt = t.text()
      const pm = txt.match(/\(([^)]*pauze[^)]*)\)/i) || txt.match(/\((\d+\s*min[^)]*)\)/i)
      const pause = pm ? pm[1].trim() : null

      ass.push({ place, time, pause })
    })

    days.push({
      date,
      weekday: wd,
      weekday_full: weekdayFull[wd],
      assignments: ass,
      hasassignment: ass.length > 0
    })
  })

  console.log(`[ROSTER] Parsed ${days.length} days total`)
  return days
}

async function getRoster() {
  console.log('[MAIN] Starting getRoster()')
  
  if (!process.env.HEADERPATH) {
    throw new Error('Missing HEADERPATH in .env')
  }
  if (!process.env.EMAIL || !process.env.PASSWORD) {
    throw new Error('Missing EMAIL or PASSWORD in .env')
  }

  console.log(`[MAIN] HEADERPATH: ${process.env.HEADERPATH}`)

  const sessid = await loginAndGetSESSID()
  const days = await fetchRosterWithSESSID(sessid)

  if (!days || days.length === 0) {
    console.error('[MAIN] ERROR: No days parsed')
    throw {
      error: 'NO_DATA',
      message: 'No days parsed from page'
    }
  }

  console.log(`[MAIN] Success! Returning ${days.length} days`)
  return days
}

module.exports = { getRoster }

if (require.main === module) {
  (async () => {
    try {
      const data = await getRoster()
      console.log(JSON.stringify({ ok: true, count: data.length, data }, null, 2))
      process.exit(0)
    } catch (e) {
      if (e && typeof e === 'object') {
        console.error(JSON.stringify({ ok: false, error: e }, null, 2))
      } else {
        console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2))
      }
      process.exit(1)
    }
  })()
}