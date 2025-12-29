require('dotenv').config();
const http2 = require('http2');
const zlib = require('zlib');
const cheerio = require('cheerio');

async function getRoster() {
  if (!process.env.PHPSESSID) {
    throw new Error('Missing environment variable PHPSESSID');
  }

  const origin = 'https://app.planning.nu';
  const client = http2.connect(origin);

  return new Promise((resolve, reject) => {
    client.on('error', err => reject(err));

    const headers = {
      ':method': 'GET',
      ':path': process.env.HEADERPATH,
      ':scheme': 'https',
      ':authority': 'app.planning.nu',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-AU,en;q=0.9,nl-NL;q=0.8,nl;q=0.7,en-GB;q=0.6,en-US;q=0.5',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'cookie': `PHPSESSID=${process.env.PHPSESSID}`,
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    };

    const req = client.request(headers);
    const chunks = [];
    let responseHeaders = {};

    req.on('response', (h) => {
      responseHeaders = h;
    });

    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', () => {
      (async () => {
        try {
          const raw = Buffer.concat(chunks);
          const encoding = (responseHeaders['content-encoding'] || '').toString().toLowerCase();

          if (encoding.includes('zstd')) {
            throw new Error('Server responded with zstd encoding which is not supported by this script.');
          }

          let htmlBuffer;
          if (encoding.includes('br')) {
            htmlBuffer = await new Promise((res, rej) => zlib.brotliDecompress(raw, (e, d) => e ? rej(e) : res(d)));
          } else if (encoding.includes('gzip')) {
            htmlBuffer = await new Promise((res, rej) => zlib.gunzip(raw, (e, d) => e ? rej(e) : res(d)));
          } else if (encoding.includes('deflate')) {
            htmlBuffer = await new Promise((res, rej) => zlib.inflate(raw, (e, d) => e ? rej(e) : res(d)));
          } else {
            htmlBuffer = raw;
          }

          const html = htmlBuffer.toString('utf8');
          const $ = cheerio.load(html);

          function parseYMD(s) {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d);
          }

          function weekdayName(idx) {
            const short = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
            return short[idx];
          }

          function weekdayFull(short) {
            return {
              ma: 'maandag',
              di: 'dinsdag',
              wo: 'woensdag',
              do: 'donderdag',
              vr: 'vrijdag',
              za: 'zaterdag',
              zo: 'zondag'
            }[short];
          }

          const workdays = [];

          $('td[title]').each((i, el) => {
            const $el = $(el);
            const dateStr = $el.attr('title')?.trim();
            if (!dateStr) return;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
            const dateObj = parseYMD(dateStr);
            const dayIndex = dateObj.getDay();
            if (dayIndex < 1 || dayIndex > 5) return;
            const assignments = [];
            $el.find('.ass').each((j, a) => {
              const $a = $(a);
              const titleDiv = $a.find('div[title]').first();
              let place = titleDiv.text().trim() || titleDiv.attr('title') || null;
              if (place) {
              place = place
                .replace(/\s*>\s*/g, ', ')
                .replace(/\u003E/g, ', ')
                .replace(/\s+/g, ' ')
                .trim();
              }
              const timeText = $a.find('b').first().text().trim() || null;
              const rawText = $a.text();
              const pauzeMatch = rawText.match(/\(([^)]+pauze[^)]*)\)/i) || rawText.match(/\((\d+\s*min[^\)]*)\)/i);
              const pause = pauzeMatch ? pauzeMatch[1].trim() : null;
              assignments.push({
                place,
                time: timeText,
                pause
              });
            });
            const wd = weekdayName(dayIndex);
            workdays.push({
              date: dateStr,
              weekday: wd,
              weekday_full: weekdayFull(wd),
              assignments,
              hasassignment: assignments.length > 0
            });
          });

          resolve(workdays);
        } catch (err) {
          reject(err);
        } finally {
          try { client.close(); } catch (e) {}
        }
      })();
    });

    req.on('error', (err) => {
      try { client.close(); } catch (e) {}
      reject(err);
    });

    req.end();
  });
}

module.exports = { getRoster };

if (require.main === module) {
  getRoster().then(data => {
    console.log(JSON.stringify(data, null, 2));
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
