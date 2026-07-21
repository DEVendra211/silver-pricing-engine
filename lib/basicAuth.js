// Minimal HTTP Basic Auth gate. This tool becomes reachable from the public
// internet once hosted (Render/Vercel/etc.), unlike the localhost-only
// version — so every route needs a login, not just "security by obscure URL".

const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function basicAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedPass) {
    // Fail closed: refuse to serve anything if no password is configured,
    // rather than silently running the panel wide open.
    res.status(500).send('ADMIN_PASSWORD is not set. Configure it before deploying.');
    return;
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    if (timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) {
      next();
      return;
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Silver Pricing Engine"');
  res.status(401).send('Authentication required.');
}

module.exports = basicAuth;
