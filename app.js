// The Express app itself, with no .listen() call — reused by both the local
// runner (server.js) and the serverless entry point (api/index.js) so the
// same code runs identically on localhost and once deployed for free.

require('dotenv').config();
const express = require('express');
const path = require('path');

const basicAuth = require('./lib/basicAuth');
const { getSilverRate, setSilverRate } = require('./lib/shopRate');
const { recalculateAllPrices } = require('./lib/recalculate');

const app = express();

app.use(express.json());
app.use(basicAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/rate', async (req, res) => {
  try {
    const rate = await getSilverRate();
    res.json(rate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rate', async (req, res) => {
  try {
    const rate = Number(req.body.ratePerGram);
    const updated = await setSilverRate(rate);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/recalculate', async (req, res) => {
  try {
    const summary = await recalculateAllPrices();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
