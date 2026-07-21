// Core silver pricing formula. Kept dependency-free so it can be reused by
// both the backend sync job and (if ever needed) a serverless function.

const GST_RATE = 0.03; // 3% GST, applied to the subtotal

/**
 * Fields required to price a single variant. Any missing/non-numeric field
 * is treated as invalid so callers can show a fallback instead of a wrong price.
 * @typedef {Object} PricingInputs
 * @property {number} weightGrams
 * @property {number} makingChargesPercent
 * @property {number} packagingCharges
 * @property {number} profitMargin
 * @property {number} ratePerGram
 */

/**
 * Validates that all pricing inputs are present and are finite, non-negative numbers.
 * @param {Partial<PricingInputs>} inputs
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validatePricingInputs(inputs) {
  const requiredFields = [
    'weightGrams',
    'makingChargesPercent',
    'packagingCharges',
    'profitMargin',
    'ratePerGram',
  ];

  const missing = requiredFields.filter((field) => {
    const value = inputs[field];
    return typeof value !== 'number' || Number.isNaN(value) || value < 0;
  });

  return { valid: missing.length === 0, missing };
}

/**
 * Computes the final selling price for one variant.
 *
 *   silverValue    = weight x rate
 *   makingCharges  = silverValue x (makingChargesPercent / 100)
 *   subtotal       = silverValue + makingCharges + packagingCharges + profitMargin
 *   finalPrice     = subtotal x (1 + GST_RATE)
 *
 * @param {PricingInputs} inputs
 * @returns {{ silverValue: number, makingCharges: number, subtotal: number, gst: number, finalPrice: number }}
 */
function calculateFinalPrice(inputs) {
  const { valid, missing } = validatePricingInputs(inputs);
  if (!valid) {
    throw new Error(`Missing/invalid pricing inputs: ${missing.join(', ')}`);
  }

  const { weightGrams, makingChargesPercent, packagingCharges, profitMargin, ratePerGram } = inputs;

  const silverValue = weightGrams * ratePerGram;
  const makingCharges = silverValue * (makingChargesPercent / 100);
  const subtotal = silverValue + makingCharges + packagingCharges + profitMargin;
  const gst = subtotal * GST_RATE;
  const finalPrice = subtotal + gst;

  return {
    silverValue: round2(silverValue),
    makingCharges: round2(makingCharges),
    subtotal: round2(subtotal),
    gst: round2(gst),
    finalPrice: round2(finalPrice),
  };
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatINR(value) {
  return `₹${round2(value).toFixed(2)}`;
}

module.exports = { GST_RATE, validatePricingInputs, calculateFinalPrice, round2, formatINR };
