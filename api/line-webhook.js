const crypto = require('crypto');

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(raw, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(raw)
      .digest('base64');
    // ใช้ string ธรรมดาเทียบ ป้องกัน error "different length"
    return signature === expected;
  } catch (e) {
    console.warn('verifySignature error:', e.message);
    return false;
  }
}

async function lineReply(replyToken, messages) {
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ replyToken, messages })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.warn('LINE reply error:', r.status, t.slice(0, 200));
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const raw = await readRawBody(req);
  const okSig = verifySignature(
    raw,
    req.headers['x-line-signature'],
    process.env.LINE_CHANNEL_SECRET
  );
  if (!okSig) {
    return res.status(401).send('Invalid signature');
  }

  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(200).send('OK');
  }

  const events = Array.isArray(body.events) ? body.events : [];
  res.status(200).send('OK'); // ตอบกลับเร็ว ๆ ให้ LINE ก่อน

  for (const ev of events) {
    try {
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = ev.message.text.trim().toLowerCase();
        if (text === 'check staff today') {
          await lineReply(ev.replyToken, [
            { type: 'text', text: 'รับคำสั่งแล้ว กำลังตรวจเช็ค…' }
          ]);
        }
      }
    } catch (err) {
      console.warn('event error:', err.message);
    }
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
