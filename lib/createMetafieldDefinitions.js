// One-time setup script: creates the PRODUCT/PRODUCTVARIANT metafield
// definitions this engine relies on. Run with: npm run setup-metafields
//
// The global rate is NOT a metafield here — see createRateMetaobject.js —
// because Metaobjects get a native edit screen in Shopify admin
// (Content > Metaobjects), unlike shop metafields.
//
// Safe to re-run — Shopify returns a TAKEN error for definitions that already
// exist, which this script logs and skips rather than failing.

const { shopifyGraphQL } = require('./shopifyAdmin');

const NAMESPACE = 'silver_pricing';

const DEFINITIONS = [
  {
    ownerType: 'PRODUCT',
    key: 'weight_grams',
    name: 'Silver Weight (grams)',
    type: 'number_decimal',
    description: 'Default silver weight for this product. Overridden per-variant if a variant sets its own weight_grams.',
  },
  {
    ownerType: 'PRODUCT',
    key: 'making_charges_percent',
    name: 'Making Charges (%)',
    type: 'number_decimal',
    description: 'Percentage of silver value charged as making charges.',
  },
  {
    ownerType: 'PRODUCT',
    key: 'packaging_charges',
    name: 'Packaging Charges (₹)',
    type: 'number_decimal',
    description: 'Flat packaging charge in rupees.',
  },
  {
    ownerType: 'PRODUCT',
    key: 'profit_margin',
    name: 'Profit Margin (₹)',
    type: 'number_decimal',
    description: 'Flat profit margin in rupees.',
  },
  {
    ownerType: 'PRODUCTVARIANT',
    key: 'weight_grams',
    name: 'Silver Weight (grams) — variant override',
    type: 'number_decimal',
    description: 'Set only on variants whose weight differs from the product default (e.g. different sizes).',
  },
  {
    ownerType: 'PRODUCTVARIANT',
    key: 'making_charges_percent',
    name: 'Making Charges (%) — variant override',
    type: 'number_decimal',
    description: 'Optional per-variant override of making charges %.',
  },
  {
    ownerType: 'PRODUCTVARIANT',
    key: 'packaging_charges',
    name: 'Packaging Charges (₹) — variant override',
    type: 'number_decimal',
    description: 'Optional per-variant override of packaging charges.',
  },
  {
    ownerType: 'PRODUCTVARIANT',
    key: 'profit_margin',
    name: 'Profit Margin (₹) — variant override',
    type: 'number_decimal',
    description: 'Optional per-variant override of profit margin.',
  },
];

const CREATE_MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key ownerType }
      userErrors { field message code }
    }
  }
`;

async function run() {
  for (const def of DEFINITIONS) {
    const variables = {
      definition: {
        name: def.name,
        namespace: NAMESPACE,
        key: def.key,
        description: def.description,
        type: def.type,
        ownerType: def.ownerType,
      },
    };

    const data = await shopifyGraphQL(CREATE_MUTATION, variables);
    const { createdDefinition, userErrors } = data.metafieldDefinitionCreate;

    if (createdDefinition) {
      console.log(`Created: ${def.ownerType}.${NAMESPACE}.${def.key}`);
    } else {
      const alreadyExists = userErrors.some((e) => e.code === 'TAKEN');
      if (alreadyExists) {
        console.log(`Skipped (already exists): ${def.ownerType}.${NAMESPACE}.${def.key}`);
      } else {
        console.error(`Failed: ${def.ownerType}.${NAMESPACE}.${def.key}`, userErrors);
      }
    }
  }

  console.log('\nDone. You can now set metafield values in Shopify admin under each product,');
  console.log('and set the shop-wide rate from the local admin panel (npm start).');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
