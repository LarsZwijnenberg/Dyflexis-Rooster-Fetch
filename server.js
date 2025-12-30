require('dotenv').config();
const express = require('express');
const { getRoster } = require('./script');

const app = express();

app.get('/rooster', async (req, res) => {
  try {
    const data = await getRoster();
    if (Array.isArray(data) && data.length === 0) {
      return res.status(401).json({ error: 'SESSID VERLOPEN' });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/shifts', async (req, res) => {
  try {
    const data = await getRoster();
    if (Array.isArray(data) && data.length === 0) {
      return res.status(401).json({ error: 'SESSID VERLOPEN' });
    }
    const only = data.filter(d => d.hasassignment);
    res.json(only);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on PORT ${PORT}`));
