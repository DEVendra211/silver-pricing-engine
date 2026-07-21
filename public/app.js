const rateInput = document.getElementById('rate');
const currentRateNote = document.getElementById('currentRateNote');
const updateBtn = document.getElementById('updatePrices');
const updateStatus = document.getElementById('updateStatus');
const summaryEl = document.getElementById('summary');
const summaryList = document.getElementById('summaryList');
const incompleteDetails = document.getElementById('incompleteDetails');
const incompleteList = document.getElementById('incompleteList');
const errorDetails = document.getElementById('errorDetails');
const errorList = document.getElementById('errorList');

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = `status ${kind || ''}`;
}

async function loadCurrentRate() {
  try {
    const res = await fetch('/api/rate');
    const data = await res.json();
    if (data.ratePerGram != null) {
      rateInput.value = data.ratePerGram;
      setStatus(
        currentRateNote,
        `Current rate: ₹${data.ratePerGram}/g (last updated ${new Date(data.updatedAt).toLocaleString()})`,
        ''
      );
    } else {
      setStatus(currentRateNote, 'No rate set yet — enter one below.', '');
    }
  } catch (err) {
    setStatus(currentRateNote, `Could not load current rate: ${err.message}`, 'error');
  }
}

updateBtn.addEventListener('click', async () => {
  const ratePerGram = parseFloat(rateInput.value);
  if (Number.isNaN(ratePerGram) || ratePerGram <= 0) {
    setStatus(updateStatus, 'Enter a valid positive rate.', 'error');
    return;
  }

  updateBtn.disabled = true;
  summaryEl.hidden = true;

  try {
    // Step 1: save the rate
    setStatus(updateStatus, 'Saving rate…', '');
    const saveRes = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratePerGram }),
    });
    if (!saveRes.ok) throw new Error((await saveRes.json()).error);

    // Step 2: recalculate every product's price from that rate
    setStatus(
      updateStatus,
      `Rate saved (₹${ratePerGram.toFixed(2)}/g). Recalculating all product prices… this can take a minute for large catalogs.`,
      ''
    );
    const recalcRes = await fetch('/api/recalculate', { method: 'POST' });
    const summary = await recalcRes.json();
    if (!recalcRes.ok) throw new Error(summary.error);

    setStatus(updateStatus, 'Done — prices are updated.', 'success');
    renderSummary(summary);
    loadCurrentRate();
  } catch (err) {
    setStatus(updateStatus, `Failed: ${err.message}`, 'error');
  } finally {
    updateBtn.disabled = false;
  }
});

function renderSummary(summary) {
  summaryList.innerHTML = `
    <li>Rate used: ₹${summary.ratePerGram}/gram</li>
    <li>Variants updated: ${summary.updated}</li>
    <li>Products with no silver pricing set (untouched): ${summary.skippedNotPriced}</li>
    <li>Incomplete (missing metafields): ${summary.incomplete.length}</li>
    <li>Errors: ${summary.errors.length}</li>
  `;

  if (summary.incomplete.length > 0) {
    incompleteList.innerHTML = summary.incomplete
      .map((i) => `<li>${i.product} — ${i.variant}: missing ${i.missing.join(', ')}</li>`)
      .join('');
    incompleteDetails.hidden = false;
  } else {
    incompleteDetails.hidden = true;
  }

  if (summary.errors.length > 0) {
    errorList.innerHTML = summary.errors.map((e) => `<li>${e.product}: ${e.message}</li>`).join('');
    errorDetails.hidden = false;
  } else {
    errorDetails.hidden = true;
  }

  summaryEl.hidden = false;
}

loadCurrentRate();
