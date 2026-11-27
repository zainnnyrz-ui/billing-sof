(() => {
    const $ = id => document.getElementById(id);
    const key = 'invoicepro-data-v1';
    const makeId = () => crypto.randomUUID();
    const isFiniteNonNegative = value => Number.isFinite(value) && value >= 0;
    const loadState = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(key) || 'null');
            if (!raw || typeof raw !== 'object') return { inventory: [], settings: {} };
            const inventory = Array.isArray(raw.inventory) ? raw.inventory.map(item => {
                if (!item || typeof item !== 'object') return null;
                const name = String(item.name ?? '').trim();
                const rate = Number(item.rate), stock = Number(item.stock);
                if (!name || !isFiniteNonNegative(rate) || !isFiniteNonNegative(stock)) return null;
                const category = typeof item.category === 'string' ? item.category.trim() : '';
                return { id: typeof item.id === 'string' && item.id ? item.id : makeId(), name, rate, stock, category };
            }).filter(Boolean) : [];
            const settings = raw.settings && typeof raw.settings === 'object' ? Object.fromEntries(
                Object.entries(raw.settings).filter(([id, value]) => typeof id === 'string' && typeof value === 'string')
            ) : {};
            return { inventory, settings };
        } catch {
            return { inventory: [], settings: {} };
        }
    };
    const state = loadState();
    const save = () => localStorage.setItem(key, JSON.stringify(state));
    const money = n => Number(n || 0).toFixed(2);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const electricalCategories = window.inventoryCatalog?.electricalCategories || [];
    const productCategories = ['Plumbing', ...electricalCategories, 'Uncategorized'];
    const seedCatalog = () => {
        if (state.settings.catalogSeedVersion === '1') return;
        const existingByName = new Map(state.inventory.map(item => [item.name.toLowerCase(), item]));
        (window.inventoryCatalog?.items || []).forEach(product => {
            const name = String(product.name || '').trim();
            const rate = Number(product.rate);
            if (!name || !isFiniteNonNegative(rate)) return;
            const existing = existingByName.get(name.toLowerCase());
            if (existing) {
                if (!existing.category) existing.category = product.category;
                return;
            }
            const item = { id: makeId(), name, rate, stock: 0, category: product.category };
            state.inventory.push(item);
            existingByName.set(name.toLowerCase(), item);
        });
        state.settings.catalogSeedVersion = '1';
        save();
    };
    const setCategoryOptions = () => {
        $('inventory-category-filter').innerHTML = [
            '<option value="">All categories</option>',
            '<option value="Plumbing">Plumbing</option>',
            `<optgroup label="Electrical"><option value="Electrical">All electrical</option>${electricalCategories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}</optgroup>`,
            '<option value="Uncategorized">Other / Uncategorized</option>'
        ].join('');
        $('modal-item-category').innerHTML = [
            '<option value="Plumbing">Plumbing</option>',
            ...electricalCategories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`),
            '<option value="Uncategorized">Other / Uncategorized</option>'
        ].join('');
    };
    seedCatalog();
    let bill = [], selected = null, searchMatches = [], activeSearchIndex = -1;

    if (!$('inv-date').value) $('inv-date').value = new Date().toISOString().slice(0, 10);
    if (!$('inv-no').value) $('inv-no').value = `INV-${Date.now().toString().slice(-6)}`;
    Object.entries(state.settings).forEach(([id, value]) => { if ($(id)) $(id).value = value; });

    const renderInventory = () => {
        const query = $('inventory-search').value.trim().toLowerCase();
        const category = $('inventory-category-filter').value;
        $('inventory-body').innerHTML = state.inventory.filter(x => {
            const categoryMatch = !category || (category === 'Electrical' ? electricalCategories.includes(x.category) : x.category === category);
            return categoryMatch && x.name.toLowerCase().includes(query);
        }).map(x => `
            <tr><td>${esc(x.name)}</td><td>₹${money(x.rate)}</td>
            <td class="action-cell"><div class="action-group"><button class="small-btn" data-edit="${esc(x.id)}">Edit</button><button class="small-btn danger" data-delete="${esc(x.id)}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="3" class="muted">No products found.</td></tr>';
        renderBulkStock(); renderBulkAdd();
    };
    const renderBill = () => {
        $('bill-body').innerHTML = bill.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>₹${money(x.rate)}</td><td>₹${money(x.qty * x.rate)}</td><td class="text-center"><button class="delete-btn" data-remove="${i}" title="Remove">×</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted text-center">Add products to start the bill.</td></tr>';
        $('bill-total').textContent = money(bill.reduce((s, x) => s + x.qty * x.rate, 0));
    };
    const closeSearchSuggestions = () => {
        $('search-results').classList.add('hidden');
        $('item-search').setAttribute('aria-expanded', 'false');
        $('item-search').removeAttribute('aria-activedescendant');
        activeSearchIndex = -1;
    };
    const updateActiveSearchOption = () => {
        searchMatches.forEach((item, index) => {
            const option = $(`search-option-${item.id}`);
            if (!option) return;
            const active = index === activeSearchIndex;
            option.classList.toggle('active', active);
            option.setAttribute('aria-selected', String(active));
        });
        const activeItem = searchMatches[activeSearchIndex];
        if (activeItem) $('item-search').setAttribute('aria-activedescendant', `search-option-${activeItem.id}`);
        else $('item-search').removeAttribute('aria-activedescendant');
    };
    const results = () => {
        const q = $('item-search').value.trim().toLowerCase();
        searchMatches = q ? state.inventory.filter(x => x.name.toLowerCase().includes(q)).slice(0, 8) : [];
        activeSearchIndex = -1;
        $('search-results').innerHTML = searchMatches.map((x, index) => `
            <div id="search-option-${esc(x.id)}" role="option" aria-selected="${index === activeSearchIndex}" data-pick="${esc(x.id)}">
                ${esc(x.name)} <span class="muted">(₹${money(x.rate)} each)</span>
            </div>`).join('');
        const isOpen = Boolean(q && searchMatches.length);
        $('search-results').classList.toggle('hidden', !isOpen);
        $('item-search').setAttribute('aria-expanded', String(isOpen));
        updateActiveSearchOption();
    };
    const selectSearchResult = item => {
        selected = item;
        searchMatches = [];
        $('item-search').value = item.name;
        $('selected-item-info').textContent = `Rate: ₹${money(item.rate)} each.`;
        $('search-results').innerHTML = '';
        closeSearchSuggestions();
    };
    const openModal = (id, item) => { $('item-modal').classList.remove('hidden'); $('modal-item-id').value = id || ''; $('modal-title').textContent = item ? 'Edit Item' : 'Add Item'; $('modal-item-name').value = item?.name || ''; $('modal-item-category').value = item?.category || 'Uncategorized'; $('modal-item-rate').value = item?.rate ?? ''; $('modal-item-stock').value = item?.stock ?? ''; };
    const close = id => $(id).classList.add('hidden');
    const renderBulkStock = () => { if (!$('bulk-stock-body')) return; $('bulk-stock-body').innerHTML = state.inventory.map(x => `<tr><td>${esc(x.name)}</td><td>${money(x.stock)}</td><td><input type="number" min="0" step=".01" data-stock-add="${esc(x.id)}" value="0"></td></tr>`).join(''); };
    const renderBulkAdd = () => { if (!$('bulk-inventory-body')) return; $('bulk-inventory-body').innerHTML = state.inventory.map(x => `<tr><td>${esc(x.name)}</td><td>₹${money(x.rate)}</td><td><input type="number" min="0" step=".01" data-bulk-qty="${esc(x.id)}" value="0"></td></tr>`).join(''); };
    const createRows = () => { $('bulk-create-body').insertAdjacentHTML('beforeend', '<tr><td><input data-new-name placeholder="Product name"></td><td><input data-new-rate type="number" min="0" step=".01"></td><td><input data-new-stock type="number" min="0" step=".01" value="0"></td></tr>'); };

    document.querySelectorAll('.nav-btn').forEach(btn => btn.onclick = () => { document.querySelectorAll('.nav-btn,.page').forEach(e => e.classList.remove('active')); btn.classList.add('active'); $(btn.dataset.target).classList.add('active'); });
    $('item-search').oninput = () => { selected = null; $('selected-item-info').textContent = 'Select a product to view its price.'; results(); };
    $('item-search').onkeydown = e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!searchMatches.length) return;
            e.preventDefault();
            if ($('search-results').classList.contains('hidden')) {
                $('search-results').classList.remove('hidden');
                $('item-search').setAttribute('aria-expanded', 'true');
            }
            if (activeSearchIndex === -1) activeSearchIndex = e.key === 'ArrowDown' ? 0 : searchMatches.length - 1;
            else activeSearchIndex = (activeSearchIndex + (e.key === 'ArrowDown' ? 1 : -1) + searchMatches.length) % searchMatches.length;
            updateActiveSearchOption();
        } else if (e.key === 'Enter' && !$('search-results').classList.contains('hidden')) {
            e.preventDefault();
            const item = searchMatches[activeSearchIndex] || (searchMatches.length === 1 ? searchMatches[0] : null);
            if (item) selectSearchResult(item);
        } else if (e.key === 'Escape' && !$('search-results').classList.contains('hidden')) {
            e.preventDefault();
            closeSearchSuggestions();
        }
    };
    $('search-results').onclick = e => {
        const option = e.target.closest('[data-pick]');
        const item = option && state.inventory.find(x => x.id === option.dataset.pick);
        if (item) selectSearchResult(item);
    };
    $('add-to-bill-btn').onclick = () => { const item = selected || state.inventory.find(x => x.name.toLowerCase() === $('item-search').value.toLowerCase()); const qty = Number($('item-qty').value); const existing = item && bill.find(x => x.id === item.id); if (!item || !Number.isFinite(qty) || qty <= 0) return alert('Select a product and enter a valid quantity.'); if (existing) existing.qty += qty; else bill.push({ ...item, qty }); selected = null; $('item-search').value = ''; $('selected-item-info').textContent = 'Select a product to view its price.'; renderBill(); };
    $('bill-body').onclick = e => { const i = e.target.dataset.remove; if (i !== undefined) { bill.splice(Number(i), 1); renderBill(); } };
    $('inventory-search').oninput = renderInventory;
    $('inventory-category-filter').onchange = renderInventory;
    $('add-new-item-btn').onclick = () => openModal();
    $('inventory-body').onclick = e => { const id = e.target.dataset.edit || e.target.dataset.delete; if (!id) return; const item = state.inventory.find(x => x.id === id); if (e.target.dataset.edit) openModal(id, item); else if (confirm(`Delete ${item.name}?`)) { state.inventory = state.inventory.filter(x => x.id !== id); save(); renderInventory(); } };
    $('modal-cancel-btn').onclick = () => close('item-modal');
    $('modal-save-btn').onclick = () => { const name = $('modal-item-name').value.trim(), category = $('modal-item-category').value, rate = Number($('modal-item-rate').value), stock = Number($('modal-item-stock').value); if (!name || !productCategories.includes(category) || !isFiniteNonNegative(rate) || !isFiniteNonNegative(stock)) return alert('Enter valid product details.'); const id = $('modal-item-id').value; if (id) Object.assign(state.inventory.find(x => x.id === id), { name, category, rate, stock }); else state.inventory.push({ id: makeId(), name, category, rate, stock }); save(); close('item-modal'); renderInventory(); };
    $('bulk-stock-btn').onclick = () => { renderBulkStock(); $('bulk-stock-modal').classList.remove('hidden'); };
    $('bulk-stock-cancel-btn').onclick = () => close('bulk-stock-modal');
    $('bulk-stock-save-btn').onclick = () => { document.querySelectorAll('[data-stock-add]').forEach(input => { const item = state.inventory.find(x => x.id === input.dataset.stockAdd); item.stock += Math.max(0, Number(input.value) || 0); }); save(); close('bulk-stock-modal'); renderInventory(); };
    $('bulk-create-btn').onclick = () => { $('bulk-create-body').innerHTML = ''; createRows(); createRows(); $('bulk-create-modal').classList.remove('hidden'); };
    $('add-bulk-row-btn').onclick = createRows;
    $('bulk-create-cancel-btn').onclick = () => close('bulk-create-modal');
    $('bulk-create-save-btn').onclick = () => { document.querySelectorAll('#bulk-create-body tr').forEach(row => { const name = row.querySelector('[data-new-name]').value.trim(); if (name) state.inventory.push({ id: crypto.randomUUID(), name, category: 'Uncategorized', rate: Number(row.querySelector('[data-new-rate]').value) || 0, stock: Number(row.querySelector('[data-new-stock]').value) || 0 }); }); save(); close('bulk-create-modal'); renderInventory(); };
    $('bulk-add-btn').onclick = () => { renderBulkAdd(); $('bulk-modal').classList.remove('hidden'); };
    $('bulk-cancel-btn').onclick = () => close('bulk-modal');
    $('bulk-save-btn').onclick = () => { document.querySelectorAll('[data-bulk-qty]').forEach(input => { const item = state.inventory.find(x => x.id === input.dataset.bulkQty), qty = Number(input.value), existing = item && bill.find(x => x.id === item.id); if (item && Number.isFinite(qty) && qty > 0) { if (existing) existing.qty += qty; else bill.push({ ...item, qty }); } }); close('bulk-modal'); renderBill(); };
    $('save-settings-btn').onclick = () => { ['dist-name','dist-addr1','dist-addr2','dist-addr3','dist-state','dist-contact','dist-email','dist-gstin'].forEach(id => state.settings[id] = $(id).value.trim()); save(); alert('Profile saved.'); };
    $('generate-invoice-btn').onclick = () => { if (!bill.length) return alert('Add at least one product to the bill.'); if (bill.some(line => !state.inventory.some(item => item.id === line.id) || !Number.isFinite(line.qty) || line.qty <= 0)) return alert('The bill contains an invalid product or quantity. Review it before completing the invoice.'); $('print-distributor').innerHTML = ['dist-name','dist-addr1','dist-addr2','dist-addr3','dist-state','dist-contact','dist-email','dist-gstin'].map(id => state.settings[id] ? `<div>${esc(state.settings[id])}</div>` : '').join(''); $('print-cust-name').textContent = $('cust-name').value; $('print-cust-address').textContent = $('cust-address').value; $('print-cust-gstin').textContent = $('cust-gstin').value; $('print-inv-date').textContent = `Date: ${$('inv-date').value}`; $('print-inv-no').textContent = `Invoice No: ${$('inv-no').value}`; $('print-table-body').innerHTML = bill.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>₹${money(x.rate)}</td><td>₹${money(x.qty * x.rate)}</td></tr>`).join(''); $('print-total').innerHTML = `<strong>${money(bill.reduce((s, x) => s + x.qty * x.rate, 0))}</strong>`; window.print(); bill = []; renderBill(); };
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));
    setCategoryOptions(); renderInventory(); renderBill();
})();
