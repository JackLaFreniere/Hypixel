// site.js - cleaned and organized site behavior for the calculators page
(function () {
    'use strict';

    // Elements
    const catButtons = document.querySelectorAll('.cat-btn');
    const dropdowns = document.querySelectorAll('.dropdown');
    const dropdownItems = document.querySelectorAll('.dropdown-item[data-filter]');
    const grid = document.querySelector('.calculator-grid');
    let cards = Array.from(document.querySelectorAll('.calculator-card'));
    const searchInput = document.getElementById('calc-search');
    const searchClear = document.getElementById('search-clear');
    const sortSelect = document.getElementById('sort-select');

    // Utilities
    function closeAllDropdowns() {
        dropdowns.forEach(d => d.classList.remove('open'));
        catButtons.forEach(b => b.classList.remove('active'));
    }

    function showAllCards() {
        cards.forEach(c => { c.style.display = 'block'; });
    }

    function resetCategorySelection() {
        closeAllDropdowns();
        const allBtn = document.querySelector('.cat-btn[data-cat="All"]');
        if (allBtn) allBtn.classList.add('active');
    }

    function setNoResults(visible) {
        const el = document.getElementById('no-results');
        if (!el) return;
        el.style.display = visible ? 'block' : 'none';
    }

    // Filtering
    function filterByTag(tag) {
        if (!tag) {
            showAllCards();
            setNoResults(false);
            return;
        }

        const needle = String(tag).toLowerCase();
        const toShow = [];
        const toHide = [];

        cards.forEach(c => {
            const tags = (c.dataset.tags || '').toLowerCase();
            if (tags.split(',').some(t => t.trim().includes(needle))) {
                toShow.push(c);
            } else {
                toHide.push(c);
            }
        });

        toHide.forEach(c => {
            if (c.style.display !== 'none') {
                c.classList.add('is-hiding');
                setTimeout(() => { c.classList.remove('is-hiding'); c.style.display = 'none'; }, 260);
            }
        });

        toShow.forEach(c => {
            if (c.style.display === 'none' || getComputedStyle(c).display === 'none') {
                c.style.display = 'block';
                c.classList.add('is-showing');
                requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove('is-showing')));
            } else {
                c.classList.add('highlight');
                setTimeout(() => c.classList.remove('highlight'), 340);
            }
        });

        setNoResults(toShow.length === 0);
    }

    // Search (strict substring)
    function applySearch(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) {
            resetCategorySelection();
            showAllCards();
            setNoResults(false);
            return;
        }

        resetCategorySelection();

        const toShow = [];
        cards.forEach(c => {
            const name = (c.querySelector('h3')?.textContent || '').toLowerCase();
            const desc = (c.querySelector('p')?.textContent || '').toLowerCase();
            const tags = (c.dataset.tags || '').toLowerCase();
            if (name.includes(q) || desc.includes(q) || tags.includes(q)) {
                toShow.push(c);
            }
        });

        const toShowSet = new Set(toShow);
        const toHide = cards.filter(c => !toShowSet.has(c));

        toHide.forEach(c => {
            if (c.style.display !== 'none') {
                c.classList.add('is-hiding');
                setTimeout(() => { c.classList.remove('is-hiding'); c.style.display = 'none'; }, 260);
            }
        });
        toShow.forEach(c => {
            if (c.style.display === 'none' || getComputedStyle(c).display === 'none') {
                c.style.display = 'block';
                c.classList.add('is-showing');
                requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove('is-showing')));
            } else {
                c.classList.add('highlight');
                setTimeout(() => c.classList.remove('highlight'), 340);
            }
        });

        setNoResults(toShow.length === 0);
    }

    // Debounce helper
    function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

    // Sorting (keeps current filtered visibility)
    function sortCards(mode) {
        const visibleOnly = Array.from(cards).filter(c => c.style.display !== 'none');
        const target = visibleOnly.length ? visibleOnly : cards.slice();

        const getName = (card) => (card.querySelector('h3')?.textContent || '').trim().toLowerCase();
        const getType = (card) => (card.dataset.type || '').trim().toLowerCase();

        switch (mode) {
            case 'name-asc': target.sort((a, b) => getName(a).localeCompare(getName(b))); break;
            case 'name-desc': target.sort((a, b) => getName(b).localeCompare(getName(a))); break;
            case 'type-asc': target.sort((a, b) => getType(a).localeCompare(getType(b))); break;
            case 'type-desc': target.sort((a, b) => getType(b).localeCompare(getType(a))); break;
            default: break;
        }

        target.forEach(node => grid.appendChild(node));
        cards = Array.from(document.querySelectorAll('.calculator-card'));
    }

    // --- Event wiring ---
    // Category buttons
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            if (cat === 'All') {
                closeAllDropdowns();
                btn.classList.add('active');
                showAllCards();
                return;
            }

            const dropdown = document.querySelector(`.dropdown[data-cat="${cat}"]`);
            const isOpen = dropdown && dropdown.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen && dropdown) {
                dropdown.classList.add('open');
                btn.classList.add('active');
            }
        });
    });

    // Dropdown items -> filter
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const tag = item.dataset.filter;
            dropdownItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            const parentDropdown = item.closest('.dropdown');
            const cat = parentDropdown && parentDropdown.dataset.cat;
            closeAllDropdowns();
            const catBtn = document.querySelector(`.cat-btn[data-cat="${cat}"]`);
            if (catBtn) catBtn.classList.add('active');

            filterByTag(tag);
        });
    });

    // Search wiring
    if (searchInput) {
        const onSearch = debounce((e) => { applySearch(e.target.value); }, 220);
        searchInput.addEventListener('input', onSearch);
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.value = ''; applySearch(''); } });
    }
    if (searchClear) {
        searchClear.addEventListener('click', () => { if (searchInput) { searchInput.value = ''; searchInput.focus(); applySearch(''); } });
    }

    // Sorting
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => sortCards(e.target.value));
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sidebar')) { resetCategorySelection(); showAllCards(); }
    });

    // Initial state
    resetCategorySelection();
    setNoResults(false);

})();
