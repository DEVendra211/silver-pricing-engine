// Read/write the single global "Today's Silver Rate" — stored as a
// Metaobject entry (type: silver_rate_settings, handle: current-rate)
// rather than a shop metafield, because metaobjects have a native edit
// screen in Shopify admin (Content > Metaobjects > Silver Rate Settings),
// so the store owner can update it without any custom app or local tool.

const { shopifyGraphQL } = require('./shopifyAdmin');

const METAOBJECT_TYPE = 'silver_rate_settings';
const METAOBJECT_HANDLE = 'current-rate';
const FIELD_KEY = 'rate_per_gram';

const GET_QUERY = `
  query GetSilverRate($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      updatedAt
      field(key: "${FIELD_KEY}") {
        value
      }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation SetSilverRate($id: ID!, $value: String!) {
    metaobjectUpdate(
      id: $id
      metaobject: { fields: [{ key: "${FIELD_KEY}", value: $value }] }
    ) {
      metaobject {
        field(key: "${FIELD_KEY}") { value }
        updatedAt
      }
      userErrors { field message code }
    }
  }
`;

async function getSilverRate() {
  const data = await shopifyGraphQL(GET_QUERY, {
    handle: { type: METAOBJECT_TYPE, handle: METAOBJECT_HANDLE },
  });

  const metaobject = data.metaobjectByHandle;
  if (!metaobject) {
    return { metaobjectId: null, ratePerGram: null, updatedAt: null };
  }

  return {
    metaobjectId: metaobject.id,
    ratePerGram: metaobject.field ? parseFloat(metaobject.field.value) : null,
    updatedAt: metaobject.updatedAt,
  };
}

async function setSilverRate(ratePerGram) {
  if (typeof ratePerGram !== 'number' || Number.isNaN(ratePerGram) || ratePerGram <= 0) {
    throw new Error('ratePerGram must be a positive number');
  }

  const { metaobjectId } = await getSilverRate();
  if (!metaobjectId) {
    throw new Error(
      `No "${METAOBJECT_TYPE}" entry with handle "${METAOBJECT_HANDLE}" found. ` +
        'Create it once in Shopify admin under Content > Metaobjects > Silver Rate Settings.'
    );
  }

  const data = await shopifyGraphQL(UPDATE_MUTATION, {
    id: metaobjectId,
    value: String(ratePerGram),
  });

  const { userErrors } = data.metaobjectUpdate;
  if (userErrors.length > 0) {
    throw new Error(`Failed to set silver rate: ${JSON.stringify(userErrors)}`);
  }

  return data.metaobjectUpdate.metaobject;
}

module.exports = { getSilverRate, setSilverRate };
