// The core sync job: reads today's silver rate + every product/variant's
// silver_pricing metafields, computes the final price, and writes it back
// to the real Shopify variant price via productVariantsBulkUpdate.
//
// This is what makes the price correct everywhere (product page, collection,
// search, cart, checkout) without any per-page Liquid/JS overrides — those
// surfaces already just render the real variant price.

const { shopifyGraphQL } = require('./shopifyAdmin');
const { getSilverRate } = require('./shopRate');
const { calculateFinalPrice, validatePricingInputs } = require('./pricing');

const NAMESPACE = 'silver_pricing';
const PAGE_SIZE = 25;

const PRODUCTS_QUERY = `
  query ProductsForPricing($cursor: String) {
    products(first: ${PAGE_SIZE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        metafields(namespace: "${NAMESPACE}", first: 10) {
          nodes { key value }
        }
        variants(first: 100) {
          nodes {
            id
            title
            price
            metafields(namespace: "${NAMESPACE}", first: 10) {
              nodes { key value }
            }
          }
        }
      }
    }
  }
`;

const BULK_UPDATE_MUTATION = `
  mutation UpdateVariantPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

function metafieldsToMap(metafieldNodes) {
  const map = {};
  for (const node of metafieldNodes) {
    const num = parseFloat(node.value);
    if (!Number.isNaN(num)) map[node.key] = num;
  }
  return map;
}

/**
 * Resolves the effective pricing inputs for one variant: a variant-level
 * value wins if present, otherwise fall back to the product-level value.
 */
function resolveInputs(productDefaults, variantOverrides, ratePerGram) {
  const pick = (key) =>
    variantOverrides[key] !== undefined ? variantOverrides[key] : productDefaults[key];

  return {
    weightGrams: pick('weight_grams'),
    makingChargesPercent: pick('making_charges_percent'),
    packagingCharges: pick('packaging_charges'),
    profitMargin: pick('profit_margin'),
    ratePerGram,
  };
}

/**
 * Runs the full recalculation across every product in the store.
 * @returns {Promise<{ratePerGram: number, updated: number, skippedNotPriced: number, incomplete: {product: string, variant: string, missing: string[]}[], errors: {product: string, message: string}[]}>}
 */
async function recalculateAllPrices() {
  const { ratePerGram } = await getSilverRate();
  if (!ratePerGram) {
    throw new Error(
      "Today's Silver Rate is not set yet. Set it from the admin panel before recalculating."
    );
  }

  let cursor = null;
  let hasNextPage = true;

  const summary = {
    ratePerGram,
    updated: 0,
    skippedNotPriced: 0,
    incomplete: [],
    errors: [],
  };

  while (hasNextPage) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { cursor });
    const { nodes, pageInfo } = data.products;

    for (const product of nodes) {
      const productDefaults = metafieldsToMap(product.metafields.nodes);
      const productHasAnySetting = Object.keys(productDefaults).length > 0;

      const variantsToUpdate = [];

      for (const variant of product.variants.nodes) {
        const variantOverrides = metafieldsToMap(variant.metafields.nodes);
        const variantHasAnySetting = Object.keys(variantOverrides).length > 0;

        if (!productHasAnySetting && !variantHasAnySetting) {
          // Not a silver-priced product/variant at all — leave its price alone.
          continue;
        }

        const inputs = resolveInputs(productDefaults, variantOverrides, ratePerGram);
        const { valid, missing } = validatePricingInputs(inputs);

        if (!valid) {
          summary.incomplete.push({
            product: product.title,
            variant: variant.title,
            missing,
          });
          continue;
        }

        const { finalPrice } = calculateFinalPrice(inputs);
        variantsToUpdate.push({ id: variant.id, price: String(finalPrice) });
      }

      if (variantsToUpdate.length === 0) {
        if (!productHasAnySetting) summary.skippedNotPriced++;
        continue;
      }

      try {
        const result = await shopifyGraphQL(BULK_UPDATE_MUTATION, {
          productId: product.id,
          variants: variantsToUpdate,
        });

        const { userErrors } = result.productVariantsBulkUpdate;
        if (userErrors.length > 0) {
          summary.errors.push({ product: product.title, message: JSON.stringify(userErrors) });
        } else {
          summary.updated += variantsToUpdate.length;
        }
      } catch (err) {
        summary.errors.push({ product: product.title, message: err.message });
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return summary;
}

module.exports = { recalculateAllPrices };
