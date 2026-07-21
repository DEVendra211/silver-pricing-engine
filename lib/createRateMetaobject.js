// One-time setup script: creates the "Silver Rate Settings" metaobject
// definition + its single entry, so today's rate can be edited natively in
// Shopify admin under Content > Metaobjects > Silver Rate Settings.
// Run with: npm run setup-rate-metaobject
//
// Safe to re-run — skips creation if the definition/entry already exist.

const { shopifyGraphQL } = require('./shopifyAdmin');

const TYPE = 'silver_rate_settings';
const HANDLE = 'current-rate';
const FIELD_KEY = 'rate_per_gram';
const DEFAULT_RATE = '0';

const DEFINITION_CREATE = `
  mutation CreateDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type name }
      userErrors { field message code }
    }
  }
`;

const ENTRY_GET = `
  query GetEntry($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) { id }
  }
`;

const ENTRY_CREATE = `
  mutation CreateEntry($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle field(key: "${FIELD_KEY}") { value } }
      userErrors { field message code }
    }
  }
`;

async function run() {
  const defResult = await shopifyGraphQL(DEFINITION_CREATE, {
    definition: {
      type: TYPE,
      name: 'Silver Rate Settings',
      description:
        'The single global silver rate (₹/gram) used to price every silver product. ' +
        'Edit the value here, then run "Recalculate Prices".',
      fieldDefinitions: [
        {
          key: FIELD_KEY,
          name: "Today's Silver Rate (₹/gram)",
          type: 'number_decimal',
          required: true,
        },
      ],
      capabilities: { publishable: { enabled: false } },
    },
  });

  const { metaobjectDefinition, userErrors: defErrors } = defResult.metaobjectDefinitionCreate;
  if (metaobjectDefinition) {
    console.log(`Created metaobject definition: ${TYPE}`);
  } else if (defErrors.some((e) => e.code === 'TAKEN')) {
    console.log(`Skipped (already exists): metaobject definition ${TYPE}`);
  } else {
    console.error('Failed to create metaobject definition:', defErrors);
    process.exit(1);
  }

  const existing = await shopifyGraphQL(ENTRY_GET, { handle: { type: TYPE, handle: HANDLE } });
  if (existing.metaobjectByHandle) {
    console.log(`Skipped (already exists): entry "${HANDLE}"`);
  } else {
    const entryResult = await shopifyGraphQL(ENTRY_CREATE, {
      metaobject: { type: TYPE, handle: HANDLE, fields: [{ key: FIELD_KEY, value: DEFAULT_RATE }] },
    });
    const { metaobject, userErrors } = entryResult.metaobjectCreate;
    if (metaobject) {
      console.log(`Created entry "${HANDLE}" with rate ${DEFAULT_RATE} (update it before using!)`);
    } else {
      console.error('Failed to create entry:', userErrors);
      process.exit(1);
    }
  }

  console.log('\nDone. Edit the rate anytime at:');
  console.log('Shopify admin -> Content -> Metaobjects -> Silver Rate Settings -> current-rate');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
