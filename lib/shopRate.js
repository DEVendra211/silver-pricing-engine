// Read/write the single global "Today's Silver Rate" — stored as a
// Metaobject entry (type: silver_rate_settings, handle: current-rate)
// rather than a shop metafield, because metaobjects have a native edit
// screen in Shopify admin (Content > Metaobjects > Silver Rate Settings),
// so the store owner can update it without any custom app or local tool.
//
// Every update also snapshots the rate it's replacing into
// previous_rate_per_gram / previous_rate_updated_at, so the storefront
// widget can show a "+/- since last update" indicator without needing a
// separate rate-history log.

const { shopifyGraphQL } = require('./shopifyAdmin');

const METAOBJECT_TYPE = 'silver_rate_settings';
const METAOBJECT_HANDLE = 'current-rate';

const GET_QUERY = `
  query GetSilverRate($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      updatedAt
      rate: field(key: "rate_per_gram") { value }
      previousRate: field(key: "previous_rate_per_gram") { value }
      previousRateDate: field(key: "previous_rate_updated_at") { value }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation SetSilverRate($id: ID!, $fields: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
      metaobject {
        rate: field(key: "rate_per_gram") { value }
        previousRate: field(key: "previous_rate_per_gram") { value }
        updatedAt
      }
      userErrors { field message code }
    }
  }
`;

function toDateOnly(isoString) {
  return isoString ? isoString.slice(0, 10) : null;
}

async function getSilverRate() {
  const data = await shopifyGraphQL(GET_QUERY, {
    handle: { type: METAOBJECT_TYPE, handle: METAOBJECT_HANDLE },
  });

  const metaobject = data.metaobjectByHandle;
  if (!metaobject) {
    return {
      metaobjectId: null,
      ratePerGram: null,
      previousRatePerGram: null,
      previousRateDate: null,
      updatedAt: null,
    };
  }

  return {
    metaobjectId: metaobject.id,
    ratePerGram: metaobject.rate ? parseFloat(metaobject.rate.value) : null,
    previousRatePerGram: metaobject.previousRate ? parseFloat(metaobject.previousRate.value) : null,
    previousRateDate: metaobject.previousRateDate ? metaobject.previousRateDate.value : null,
    updatedAt: metaobject.updatedAt,
  };
}

async function setSilverRate(ratePerGram) {
  if (typeof ratePerGram !== 'number' || Number.isNaN(ratePerGram) || ratePerGram <= 0) {
    throw new Error('ratePerGram must be a positive number');
  }

  const current = await getSilverRate();
  if (!current.metaobjectId) {
    throw new Error(
      `No "${METAOBJECT_TYPE}" entry with handle "${METAOBJECT_HANDLE}" found. ` +
        'Create it once in Shopify admin under Content > Metaobjects > Silver Rate Settings.'
    );
  }

  const fields = [{ key: 'rate_per_gram', value: String(ratePerGram) }];

  // Only snapshot a "previous" value if there was an actual prior rate to
  // remember (skips the very first-ever save).
  if (current.ratePerGram != null) {
    fields.push({ key: 'previous_rate_per_gram', value: String(current.ratePerGram) });
    fields.push({
      key: 'previous_rate_updated_at',
      value: toDateOnly(current.updatedAt) || '',
    });
  }

  const data = await shopifyGraphQL(UPDATE_MUTATION, {
    id: current.metaobjectId,
    fields,
  });

  const { userErrors } = data.metaobjectUpdate;
  if (userErrors.length > 0) {
    throw new Error(`Failed to set silver rate: ${JSON.stringify(userErrors)}`);
  }

  return data.metaobjectUpdate.metaobject;
}

module.exports = { getSilverRate, setSilverRate };
