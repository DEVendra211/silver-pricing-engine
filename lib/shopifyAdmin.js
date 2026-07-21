// Thin wrapper around the Shopify Admin GraphQL API.
//
// Shopify retired the old "Develop apps -> static token" flow for new custom
// apps. Apps created in the new Dev Dashboard instead get a Client ID +
// Client secret, and code requests a short-lived (24h) access token on
// demand via the OAuth client_credentials grant. This module handles that:
// it fetches a token, caches it in memory, and re-fetches once it's close
// to expiring — callers never see this, they just call shopifyGraphQL().

require('dotenv').config();

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

if (!STORE_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    '[shopifyAdmin] SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, or SHOPIFY_CLIENT_SECRET is missing. ' +
      'Copy .env.example to .env and fill in your Dev Dashboard app credentials before running the server.'
  );
}

const TOKEN_ENDPOINT = `https://${STORE_DOMAIN}/admin/oauth/access_token`;
const GRAPHQL_ENDPOINT = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

// Refresh a bit early so an in-flight request never gets a token that
// expires mid-call.
const REFRESH_BUFFER_MS = 60 * 1000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - REFRESH_BUFFER_MS) {
    return cachedToken;
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get Shopify access token (HTTP ${response.status}): ${text}\n` +
        'If this says "shop_not_permitted", the app (in the Dev Dashboard) and this store ' +
        'must be in the same Shopify organization, and the app must be installed on this store.'
    );
  }

  const json = await response.json();
  cachedToken = json.access_token;
  cachedTokenExpiresAt = now + json.expires_in * 1000;
  return cachedToken;
}

async function shopifyGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API HTTP ${response.status}: ${text}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`Shopify Admin API GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

module.exports = { shopifyGraphQL };
