// Local runner: `npm start` -> http://localhost:3456
// (For hosting for free, see api/index.js + README's "Deploy for free" section.)

const app = require('./app');

const PORT = process.env.PORT || 3456;

app.listen(PORT, () => {
  console.log(`Silver pricing admin panel running at http://localhost:${PORT}`);
});
