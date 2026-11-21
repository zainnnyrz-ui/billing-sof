(() => {
    const $ = id => document.getElementById(id);
    const key = 'invoicepro-data-v1';
    const state = JSON.parse(localStorage.getItem(key) || 'null') || { inventory: [], settings: {} };
    const save = () => localStorage.setItem(key, JSON.stringify(state));
    const money = n => Number(n || 0).toFixed(2);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let bill = [], selected = null;

    if (!$('inv-date').value) $('inv-date').value = new Date().toISOString().slice(0, 10);
    if (!$('inv-no').value) $('inv-no').value = `INV-${Date.now().toString().slice(-6)}`;
    Object.entries(state.settings).forEach(([id, value]) => { if ($(id)) $(id).value = value; });

    const renderInventory = filter => {
        const query = (filter || '').toLowerCase();
        $('inventory-body').innerHTML = state.inventory.filter(x => x.name.toLowerCase().includes(query)).map(x => `
            <tr><td>${esc(x.name)}</td><td>₹${money(x.rate)}</td><td class="${x.stock <= 5 ? 'low-stock' : ''}">${money(x.stock)}</td>
            <td><div class="action-group"><button class="small-btn" data-edit="${x.id}">Edit</button><button class="small-btn danger" data-delete="${x.id}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No products found.</td></tr>';
        renderBulkStock(); renderBulkAdd();
    };
    const renderBill = () => {
        $('bill-body').innerHTML = bill.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>₹${money(x.rate)}</td><td>₹${money(x.qty * x.rate)}</td><td class="text-center"><button class="delete-btn" data-remove="${i}" title="Remove">×</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted text-center">Add products to start the bill.</td></tr>';
        $('bill-total').textContent = money(bill.reduce((s, x) => s + x.qty * x.rate, 0));
    };
    const results = () => {
        const q = $('item-search').value.toLowerCase();
        const matches = state.inventory.filter(x => x.name.toLowerCase().includes(q)).slice(0, 8);
        $('search-results').innerHTML = matches.map(x => `<div data-pick="${x.id}">${esc(x.name)} <span class="muted">(${money(x.stock)} in stock)</span></div>`).join('');
        $('search-results').classList.toggle('hidden', !q || !matches.length);
    };
    const openModal = (id, item) => { $('item-modal').classList.remove('hidden'); $('modal-item-id').value = id || ''; $('modal-title').textContent = item ? 'Edit Item' : 'Add Item'; $('modal-item-name').value = item?.name || ''; $('modal-item-rate').value = item?.rate ?? ''; $('modal-item-stock').value = item?.stock ?? ''; };
    const close = id => $(id).classList.add('hidden');
    const renderBulkStock = () => { if (!$('bulk-stock-body')) return; $('bulk-stock-body').innerHTML = state.inventory.map(x => `<tr><td>${esc(x.name)}</td><td>${money(x.stock)}</td><td><input type="number" min="0" step=".01" data-stock-add="${x.id}" value="0"></td></tr>`).join(''); };
    const renderBulkAdd = () => { if (!$('bulk-inventory-body')) return; $('bulk-inventory-body').innerHTML = state.inventory.map(x => `<tr><td>${esc(x.name)}</td><td>₹${money(x.rate)}</td><td>${money(x.stock)}</td><td><input type="number" min="0" step=".01" data-bulk-qty="${x.id}" value="0"></td></tr>`).join(''); };
    const createRows = () => { $('bulk-create-body').insertAdjacentHTML('beforeend', '<tr><td><input data-new-name placeholder="Product name"></td><td><input data-new-rate type="number" min="0" step=".01"></td><td><input data-new-stock type="number" min="0" step=".01" value="0"></td></tr>'); };

    document.querySelectorAll('.nav-btn').forEach(btn => btn.onclick = () => { document.querySelectorAll('.nav-btn,.page').forEach(e => e.classList.remove('active')); btn.classList.add('active'); $(btn.dataset.target).classList.add('active'); });
    $('item-search').oninput = results;
    $('search-results').onclick = e => { const item = state.inventory.find(x => x.id === e.target.dataset.pick); if (!item) return; selected = item; $('item-search').value = item.name; $('selected-item-info').textContent = `${money(item.stock)} available at ₹${money(item.rate)} each.`; $('search-results').classList.add('hidden'); };
    $('add-to-bill-btn').onclick = () => { const item = selected || state.inventory.find(x => x.name.toLowerCase() === $('item-search').value.toLowerCase()); const qty = Number($('item-qty').value); if (!item || qty <= 0) return alert('Select a product and enter a valid quantity.'); if (qty > item.stock) return alert('Quantity exceeds available stock.'); const existing = bill.find(x => x.id === item.id); if (existing) existing.qty += qty; else bill.push({ ...item, qty }); selected = null; $('item-search').value = ''; $('selected-item-info').textContent = 'Select an item to view stock.'; renderBill(); };
    $('bill-body').onclick = e => { const i = e.target.dataset.remove; if (i !== undefined) { bill.splice(Number(i), 1); renderBill(); } };
    $('inventory-search').oninput = e => renderInventory(e.target.value);
    $('add-new-item-btn').onclick = () => openModal();
    $('inventory-body').onclick = e => { const id = e.target.dataset.edit || e.target.dataset.delete; if (!id) return; const item = state.inventory.find(x => x.id === id); if (e.target.dataset.edit) openModal(id, item); else if (confirm(`Delete ${item.name}?`)) { state.inventory = state.inventory.filter(x => x.id !== id); save(); renderInventory(); } };
    $('modal-cancel-btn').onclick = () => close('item-modal');
    $('modal-save-btn').onclick = () => { const name = $('modal-item-name').value.trim(), rate = Number($('modal-item-rate').value), stock = Number($('modal-item-stock').value); if (!name || rate < 0 || stock < 0) return alert('Enter valid product details.'); const id = $('modal-item-id').value; if (id) Object.assign(state.inventory.find(x => x.id === id), { name, rate, stock }); else state.inventory.push({ id: crypto.randomUUID(), name, rate, stock }); save(); close('item-modal'); renderInventory(); };
    $('bulk-stock-btn').onclick = () => { renderBulkStock(); $('bulk-stock-modal').classList.remove('hidden'); };
    $('bulk-stock-cancel-btn').onclick = () => close('bulk-stock-modal');
    $('bulk-stock-save-btn').onclick = () => { document.querySelectorAll('[data-stock-add]').forEach(input => { const item = state.inventory.find(x => x.id === input.dataset.stockAdd); item.stock += Math.max(0, Number(input.value) || 0); }); save(); close('bulk-stock-modal'); renderInventory(); };
    $('bulk-create-btn').onclick = () => { $('bulk-create-body').innerHTML = ''; createRows(); createRows(); $('bulk-create-modal').classList.remove('hidden'); };
    $('add-bulk-row-btn').onclick = createRows;
    $('bulk-create-cancel-btn').onclick = () => close('bulk-create-modal');
    $('bulk-create-save-btn').onclick = () => { document.querySelectorAll('#bulk-create-body tr').forEach(row => { const name = row.querySelector('[data-new-name]').value.trim(); if (name) state.inventory.push({ id: crypto.randomUUID(), name, rate: Number(row.querySelector('[data-new-rate]').value) || 0, stock: Number(row.querySelector('[data-new-stock]').value) || 0 }); }); save(); close('bulk-create-modal'); renderInventory(); };
    $('bulk-add-btn').onclick = () => { renderBulkAdd(); $('bulk-modal').classList.remove('hidden'); };
    $('bulk-cancel-btn').onclick = () => close('bulk-modal');
    $('bulk-save-btn').onclick = () => { document.querySelectorAll('[data-bulk-qty]').forEach(input => { const item = state.inventory.find(x => x.id === input.dataset.bulkQty), qty = Number(input.value) || 0; if (qty > 0 && qty <= item.stock) bill.push({ ...item, qty }); }); close('bulk-modal'); renderBill(); };
    $('save-settings-btn').onclick = () => { ['dist-name','dist-addr1','dist-addr2','dist-addr3','dist-state','dist-contact','dist-email','dist-gstin'].forEach(id => state.settings[id] = $(id).value.trim()); save(); alert('Settings saved.'); };
    $('generate-invoice-btn').onclick = () => { if (!bill.length) return alert('Add at least one product to the bill.'); bill.forEach(line => { const item = state.inventory.find(x => x.id === line.id); item.stock -= line.qty; }); $('print-distributor').innerHTML = ['dist-name','dist-addr1','dist-addr2','dist-addr3','dist-state','dist-contact','dist-email','dist-gstin'].map(id => state.settings[id] ? `<div>${esc(state.settings[id])}</div>` : '').join(''); $('print-cust-name').textContent = $('cust-name').value; $('print-cust-address').textContent = $('cust-address').value; $('print-cust-gstin').textContent = $('cust-gstin').value; $('print-inv-date').textContent = `Date: ${$('inv-date').value}`; $('print-inv-no').textContent = `Invoice No: ${$('inv-no').value}`; $('print-table-body').innerHTML = bill.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>₹${money(x.rate)}</td><td>₹${money(x.qty * x.rate)}</td></tr>`).join(''); $('print-total').innerHTML = `<strong>${money(bill.reduce((s, x) => s + x.qty * x.rate, 0))}</strong>`; save(); renderInventory(); window.print(); bill = []; renderBill(); };
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));
    renderInventory(); renderBill();
})();
