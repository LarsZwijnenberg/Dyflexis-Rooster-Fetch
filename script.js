require('dotenv').config()
const http2 = require('http2')
const zlib = require('zlib')
const cheerio = require('cheerio')

async function getRoster() {
  if (!process.env.PHPSESSID) throw new Error('Missing PHPSESSID')
  if (!process.env.HEADERPATH) throw new Error('Missing HEADERPATH')

  const client = http2.connect('https://app.planning.nu')

  return new Promise((resolve, reject) => {
    const req = client.request({
      ':method': 'GET',
      ':path': process.env.HEADERPATH,
      ':scheme': 'https',
      ':authority': 'app.planning.nu',
      'cookie': `PHPSESSID=${process.env.PHPSESSID}`,
      'accept': 'text/html',
      'accept-encoding': 'gzip, deflate, br'
    })

    const chunks = []
    let headers = {}

    req.on('response', h => headers = h)
    req.on('data', d => chunks.push(d))
    req.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks)
        const enc = (headers['content-encoding'] || '').toString()
        let buf = raw

        if (enc.includes('br')) buf = await new Promise((r, j) => zlib.brotliDecompress(raw, (e, d) => e ? j(e) : r(d)))
        if (enc.includes('gzip')) buf = await new Promise((r, j) => zlib.gunzip(raw, (e, d) => e ? j(e) : r(d)))
        if (enc.includes('deflate')) buf = await new Promise((r, j) => zlib.inflate(raw, (e, d) => e ? j(e) : r(d)))

        const $ = cheerio.load(buf.toString())
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
            let place = t.find('div[title]').attr('title') || t.find('div[title]').text()
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

        resolve(days)
      } catch (e) {
        reject(e)
      } finally {
        client.close()
      }
    })

    req.on('error', e => {
      client.close()
      reject(e)
    })

    req.end()
  })
}

module.exports = { getRoster }
