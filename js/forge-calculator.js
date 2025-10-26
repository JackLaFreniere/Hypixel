// Forge Calculator
class ForgeCalculator {
    constructor() {
        try {
            // Use unified Price API - it provides both bazaar and auction data
            this.priceAPI = window.globalPriceAPI || new PriceAPI();
        } catch (error) {
            console.error('Error initializing API:', error);
        }
        
        this.recipes = [];
        this.items = new Map();
        this.priceCache = new Map();
        this.lastPriceUpdate = null;
        
        this.initializeEventListeners();
        this.initialize();
        
        window.forgeCalculator = this;
    }
    
    async initialize() {
        try {
            // Initialize the API first (fetches all price data)
            await this.priceAPI.initialize();
            
            // Enable auto-refresh for price data (handles both bazaar and auction)
            this.priceAPI.startAutoRefresh(60000); // Every 60 seconds
            
            // Now load items and recipes
            await this.loadItemsAndRecipes();
        } catch (error) {
            console.error('Error initializing calculator:', error);
            this.showError('Failed to initialize calculator');
        }
    }

    initializeEventListeners() {
        // Filter event listeners
        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });
        
        document.getElementById('sortBy').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });
        
        document.getElementById('sellLocationFilter').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });

        document.getElementById('refreshPrices').addEventListener('click', () => {
            this.refreshPrices();
        });
        
        const resetButton = document.getElementById('resetFilters');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }
        
        // Input cost range filters (text inputs with format parsing)
        const inputCostMinText = document.getElementById('inputCostMinText');
        const inputCostMaxText = document.getElementById('inputCostMaxText');
        
        inputCostMinText.addEventListener('input', () => {
            this.filterAndSortRecipes();
        });
        
        inputCostMaxText.addEventListener('input', () => {
            this.filterAndSortRecipes();
        });
        
        // Forge time range filters
        document.getElementById('forgeTimeMin').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });
        
        document.getElementById('forgeTimeMax').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });
    }
    
    parseNumberInput(input) {
        // Parse user input like "250k", "10m", "1.5b" etc.
        if (!input || input.trim() === '') {
            return null; // No limit
        }
        
        const str = input.trim().toLowerCase();
        const match = str.match(/^([\d.]+)\s*([kmb]?)$/);
        
        if (!match) {
            // Try parsing as plain number
            const num = parseFloat(str);
            return isNaN(num) ? null : num;
        }
        
        const value = parseFloat(match[1]);
        const suffix = match[2];
        
        if (isNaN(value)) return null;
        
        switch (suffix) {
            case 'k':
                return value * 1000;
            case 'm':
                return value * 1000000;
            case 'b':
                return value * 1000000000;
            default:
                return value;
        }
    }

    async loadItemsAndRecipes() {
        try {
            // First load items.json to get item ID mappings
            await this.loadItems();
            // Then load recipes
            await this.loadRecipes();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load calculator data');
        }
    }

    async loadItems() {
        try {
            const response = await fetch('../jsons/items.json');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Create a map of item names to their IDs
            data.items.forEach(item => {
                this.items.set(item.name, item.id);
            });
        } catch (error) {
            console.error('Error loading items:', error);
            throw new Error('Failed to load items database');
        }
    }

    getItemId(itemName) {
        const itemId = this.items.get(itemName);
        return itemId || null;
    }

    async loadRecipes() {
        try {
            const response = await fetch('../jsons/forge-recipes.json');
            const data = await response.json();
            
            this.recipes = data.recipes;
            
            await this.loadPrices();
            this.filterAndSortRecipes();
        } catch (error) {
            console.error('Error loading recipes:', error);
            this.showError('Failed to load forge recipes');
        }
    }

    async loadPrices() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('recipesGrid').style.display = 'none';
        
        try {
            this.priceCache.clear();
            
            // Collect all items that need pricing
            const itemsToFetch = new Map();
            const failedItems = [];
            
            this.recipes.forEach(recipe => {
                recipe.inputs.forEach(input => {
                    if (input.source !== 'coins') {
                        itemsToFetch.set(input.name, { source: input.source, isOutput: false });
                    }
                });
                itemsToFetch.set(recipe.name, { source: recipe.sellLocation, isOutput: true });
            });
            
            // Fetch prices
            const pricePromises = Array.from(itemsToFetch).map(async ([itemName, {source, isOutput}]) => {
                try {
                    const price = await this.getItemPriceFromSource(itemName, source, isOutput);
                    this.priceCache.set(itemName, price);
                    
                    // Log completion and track failures
                    if (price === 0 && source !== 'coins') {
                        console.error(`❌ ${itemName}`);
                        failedItems.push({
                            name: itemName,
                            source: source,
                            type: isOutput ? 'output' : 'input'
                        });
                    } else {
                        console.log(`✓ ${itemName}: ${this.formatCoins(price)}`);
                    }
                } catch (error) {
                    console.error(`❌ ${itemName}`);
                    this.priceCache.set(itemName, 0);
                    failedItems.push({
                        name: itemName,
                        source: source,
                        type: isOutput ? 'output' : 'input'
                    });
                }
            });
            
            await Promise.allSettled(pricePromises);
            
            // Display summary of failed items
            if (failedItems.length > 0) {
                console.group(`⚠️ Failed: ${failedItems.length} items`);
                failedItems.forEach(item => {
                    console.log(`  • ${item.name} [${item.type}] from ${item.source}`);
                });
                console.groupEnd();
            } else {
                console.log('✅ All items loaded');
            }
            
            this.lastPriceUpdate = new Date();
            document.getElementById('lastUpdatedDisplay').textContent = 
                this.lastPriceUpdate.toLocaleTimeString();
                
        } catch (error) {
            console.error('Error loading prices:', error);
            this.showError('Failed to load market prices');
        } finally {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('recipesGrid').style.display = 'grid';
        }
    }

    async getItemPriceFromSource(itemName, source, isOutput) {
        if (source === 'coins') {
            return 0;
        }
        
        const itemId = this.getItemId(itemName);
        if (!itemId) {
            return 0;
        }
        
        try {
            // Use unified Price API - it handles both bazaar and auction
            const price = await this.priceAPI.getPrice(itemId, source);
            return price || 0;
        } catch (error) {
            return 0;
        }
    }

    calculateRecipeProfit(recipe) {
        let inputCost = 0;
        const inputDetails = [];

        recipe.inputs.forEach(input => {
            let price = 0;
            let totalCost = 0;
            
            if (input.source === 'coins') {
                price = input.coinCost || 0;
                totalCost = price * input.quantity;
            } else {
                price = this.priceCache.get(input.name) || 0;
                totalCost = price * input.quantity;
            }
            
            inputCost += totalCost;
            inputDetails.push({
                ...input,
                unitPrice: price,
                totalCost: totalCost
            });
        });

        const outputPrice = this.priceCache.get(recipe.name) || 0;
        const profit = outputPrice - inputCost;
        
        const days = recipe.time.days || 0;
        const hours = recipe.time.hours || 0;
        const minutes = recipe.time.minutes || 0;
        const seconds = recipe.time.seconds || 0;
        const totalHours = (days * 24) + hours + (minutes / 60) + (seconds / 3600);
        const profitPerHour = totalHours > 0 ? profit / totalHours : 0;

        return {
            inputCost,
            outputValue: outputPrice,
            profit,
            profitPerHour,
            inputDetails,
            totalTime: totalHours
        };
    }

    filterAndSortRecipes() {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        const sellLocationFilter = document.getElementById('sellLocationFilter').value;
        
        const inputCostMinValue = this.parseNumberInput(document.getElementById('inputCostMinText').value);
        const inputCostMaxValue = this.parseNumberInput(document.getElementById('inputCostMaxText').value);
        const inputCostMin = inputCostMinValue !== null ? inputCostMinValue : 0;
        const inputCostMax = inputCostMaxValue !== null ? inputCostMaxValue : Infinity;
        const forgeTimeMin = parseFloat(document.getElementById('forgeTimeMin').value) || 0;
        const forgeTimeMax = parseFloat(document.getElementById('forgeTimeMax').value) || 999999;
        
        let filteredRecipes = this.recipes;
        
        // Category filter
        if (categoryFilter !== 'all') {
            filteredRecipes = filteredRecipes.filter(recipe => recipe.category === categoryFilter);
        }
        
        // Sell location filter
        if (sellLocationFilter !== 'all') {
            filteredRecipes = filteredRecipes.filter(recipe => recipe.sellLocation === sellLocationFilter);
        }

        const recipesWithData = filteredRecipes.map(recipe => {
            const calculation = this.calculateRecipeProfit(recipe);
            const hasMissingInput = calculation.inputDetails.some(inp => inp.source !== 'coins' && (!inp.unitPrice || inp.unitPrice === 0));
            const hasMissingOutput = (!calculation.outputValue || calculation.outputValue === 0) && recipe.sellLocation && recipe.sellLocation !== 'coins';

            return {
                ...recipe,
                calculation,
                missingInputs: hasMissingInput || hasMissingOutput
            };
        });
        
        // Apply range filters
        const rangeFiltered = recipesWithData.filter(recipe => {
            const inputCost = recipe.calculation.inputCost;
            const forgeTime = recipe.calculation.totalTime;
            
            if (inputCost < inputCostMin || inputCost > inputCostMax) return false;
            if (forgeTime < forgeTimeMin || forgeTime > forgeTimeMax) return false;
            
            return true;
        });

        // Sort recipes
        rangeFiltered.sort((a, b) => {
            switch (sortBy) {
                case 'profit-per-hour-desc':
                    return b.calculation.profitPerHour - a.calculation.profitPerHour;
                case 'profit-per-hour-asc':
                    return a.calculation.profitPerHour - b.calculation.profitPerHour;
                case 'profit-desc':
                    return b.calculation.profit - a.calculation.profit;
                case 'profit-asc':
                    return a.calculation.profit - b.calculation.profit;
                case 'time-asc':
                    return a.calculation.totalTime - b.calculation.totalTime;
                case 'time-desc':
                    return b.calculation.totalTime - a.calculation.totalTime;
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'category-asc':
                    return a.category.localeCompare(b.category);
                default:
                    return b.calculation.profitPerHour - a.calculation.profitPerHour;
            }
        });
        
        const ready = rangeFiltered.filter(r => !r.missingInputs);
        const incomplete = recipesWithData.filter(r => r.missingInputs);
        const ordered = ready.concat(incomplete);

        this.displayRecipes(ordered);
    }

    displayRecipes(recipes) {
        const grid = document.getElementById('recipesGrid');
        
        if (recipes.length === 0) {
            grid.innerHTML = '<p class="recipes-empty">No recipes found for the selected filters.</p>';
            return;
        }

        grid.innerHTML = recipes.map(recipe => {
            const calc = recipe.calculation;
            const missingClass = recipe.missingInputs ? 'missing-inputs' : '';
            const profitClass = calc.profit > 0 ? 'profit-positive' : calc.profit < 0 ? 'profit-negative' : 'profit-neutral';
            const statusClass = calc.profit > 0 ? 'status-profitable' : calc.profit < 0 ? 'status-unprofitable' : 'status-break-even';
            
            const days = recipe.time.days || 0;
            const hours = recipe.time.hours || 0;
            const minutes = recipe.time.minutes || 0;
            const seconds = recipe.time.seconds || 0;
            const timeText = this.formatDuration(days, hours, minutes, seconds);

            return `
                <div class="recipe-card ${statusClass} ${missingClass}">
                    <div class="recipe-header">
                        <div class="recipe-name">${recipe.name}</div>
                        <div class="recipe-meta">
                            <span class="recipe-category">${recipe.category}</span>
                            <span class="recipe-time">⏱️ ${timeText}</span>
                        </div>
                    </div>
                    
                    <div class="recipe-materials">
                        ${calc.inputDetails.map(input => `
                            <div class="material-item">
                                <span class="material-name">${input.quantity}x ${input.name}</span>
                                <span class="material-cost">${
                                    input.source === 'coins' 
                                        ? this.formatCoins(input.unitPrice)
                                        : `${this.formatCoins(input.unitPrice)} ea`
                                }</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="recipe-summary">
                        <div class="cost-row">
                            <span class="label">Cost:</span>
                            <span class="value">${this.formatCoins(calc.inputCost)}</span>
                        </div>
                        <div class="sell-row">
                            <span class="label">Sells:</span>
                            <span class="value">${this.formatCoins(calc.outputValue)}</span>
                        </div>
                    </div>
                    
                    <div class="profit-section">
                        <div class="profit-item">
                            <span class="profit-label">Per Hour</span>
                            <span class="profit-amount ${profitClass}">${this.formatCoins(calc.profitPerHour)}</span>
                        </div>
                        <div class="profit-item">
                            <span class="profit-label">Total</span>
                            <span class="profit-amount ${profitClass}">${this.formatCoins(calc.profit)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatCoins(amount) {
        if (Math.abs(amount) >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M`;
        } else if (Math.abs(amount) >= 1000) {
            return `${(amount / 1000).toFixed(1)}k`;
        } else {
            return Math.round(amount).toLocaleString();
        }
    }

    formatTime(hours, minutes) {
        return `${hours}h ${minutes}m`;
    }

    formatDuration(days, hours, minutes, seconds) {
        const parts = [];
        if (days && days > 0) parts.push(`${days}d`);
        if (hours && hours > 0) parts.push(`${hours}h`);
        if (minutes && minutes > 0) parts.push(`${minutes}m`);
        if (seconds && seconds > 0) parts.push(`${seconds}s`);
        if (parts.length === 0) return '0m';
        return parts.join(' ');
    }

    async refreshPrices() {
        // Force refresh prices (bypasses cache for both bazaar and auction)
        await this.priceAPI.forceRefresh();
        
        this.priceCache.clear();
        await this.loadPrices();
        this.filterAndSortRecipes();
    }

    resetFilters() {
        // Reset all filter controls to their default values
        document.getElementById('categoryFilter').value = 'all';
        document.getElementById('sortBy').value = 'profit-per-hour-desc';
        document.getElementById('sellLocationFilter').value = 'all';
        document.getElementById('inputCostMinText').value = '';
        document.getElementById('inputCostMaxText').value = '';
        document.getElementById('forgeTimeMin').value = '0';
        document.getElementById('forgeTimeMax').value = '999999';
        
        // Re-filter and sort with default values
        this.filterAndSortRecipes();
    }

    showError(message) {
        const grid = document.getElementById('recipesGrid');
        grid.innerHTML = `
            <div class="error-container">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary reload-btn">Reload Page</button>
            </div>
        `;
        grid.style.display = 'block';
        document.getElementById('loading').style.display = 'none';
        
        const reloadBtn = grid.querySelector('.reload-btn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => location.reload());
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.forgeCalculator = new ForgeCalculator();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForgeCalculator;
}