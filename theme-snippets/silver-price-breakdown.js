// Powers the "Price breakdown" toggle and recomputes the displayed
// breakdown instantly when the shopper switches product variants.
// Upload this file to the theme as assets/silver-price-breakdown.js.

(function () {
  const GST_RATE = 0.03;

  function formatINR(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function calculate(inputs) {
    const { weightGrams, makingChargesPercent, packagingCharges, profitMargin, ratePerGram } = inputs;
    const silverValue = weightGrams * ratePerGram;
    const makingCharges = silverValue * (makingChargesPercent / 100);
    const subtotal = silverValue + makingCharges + packagingCharges + profitMargin;
    const gst = subtotal * GST_RATE;
    const finalPrice = subtotal + gst;
    return { silverValue, makingCharges, packagingCharges, profitMargin, gst, finalPrice };
  }

  function hasAllFields(inputs) {
    return ['weightGrams', 'makingChargesPercent', 'packagingCharges', 'profitMargin', 'ratePerGram'].every(
      (key) => typeof inputs[key] === 'number' && !Number.isNaN(inputs[key])
    );
  }

  function initBreakdown(root) {
    const toggle = root.querySelector('.silver-price-breakdown__toggle');
    const list = root.querySelector('.silver-price-breakdown__list');

    if (toggle && list) {
      toggle.addEventListener('click', () => {
        const isHidden = list.hasAttribute('hidden');
        if (isHidden) {
          list.removeAttribute('hidden');
        } else {
          list.setAttribute('hidden', '');
        }
        toggle.setAttribute('aria-expanded', String(isHidden));
      });
    }

    const dataScript = root.parentElement.querySelector('[data-silver-breakdown-variants]');
    if (!dataScript) return;

    let variantData;
    try {
      variantData = JSON.parse(dataScript.textContent);
    } catch (err) {
      return;
    }

    function updateForVariant(variantId) {
      const inputs = variantData.variants[variantId];
      if (!inputs) return;

      const fullInputs = { ...inputs, ratePerGram: variantData.ratePerGram };
      if (!hasAllFields(fullInputs)) {
        root.setAttribute('hidden', '');
        return;
      }
      root.removeAttribute('hidden');

      const result = calculate(fullInputs);
      Object.entries(result).forEach(([field, value]) => {
        const el = root.querySelector(`[data-field="${field}"]`);
        if (el) el.textContent = formatINR(value);
      });
    }

    // Most Online Store 2.0 themes keep a hidden `<input name="id">` with the
    // selected variant id inside the product form. Watch it for changes.
    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target && target.name === 'id' && target.form) {
        updateForVariant(target.value);
      }
    });

    // Some themes dispatch a `variant:change` custom event with the new
    // variant on `event.detail.variant` or `event.detail.resource`.
    document.addEventListener('variant:change', (event) => {
      const variant = event.detail && (event.detail.variant || event.detail.resource);
      if (variant && variant.id) updateForVariant(String(variant.id));
    });
  }

  function init() {
    document.querySelectorAll('[data-silver-breakdown]').forEach(initBreakdown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
