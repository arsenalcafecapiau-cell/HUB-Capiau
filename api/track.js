const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  // Permite que suas landing pages (em outros domínios) chamem esse endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // sendBeacon manda o body como texto puro às vezes; garantimos o parse
    var body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    var event = {
      event_type: body.event_type,
      funnel_id: body.funnel_id,
      variant: body.variant || 'A',
      step: body.step || null,
      session_id: body.session_id,
      url: body.url || null,
      referrer: body.referrer || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null
    };

    if (!event.event_type || !event.funnel_id || !event.session_id) {
      return res.status(400).json({ error: 'campos obrigatórios faltando' });
    }

    const { error } = await supabase.from('events').insert(event);
    if (error) throw error;

    return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'erro ao gravar evento' });
  }
};
