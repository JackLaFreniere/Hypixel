// Forge Calculator
class ForgeCalculator {
    constructor() {
        console.log('ForgeCalculator constructor called');
        try {
            this.bazaarAPI = window.globalBazaarAPI || new HypixelBazaarAPI();
            this.coflnetAPI = window.globalCoflnetAPI || new CoflnetAuctionAPI();
            console.log('APIs assigned successfully');
        } catch (error) {
            console.error('Error assigning APIs:', error);
        }
        
        this.recipes = [];
        this.items = new Map(); // Map item names to IDs
        this.priceCache = new Map();
        this.lastPriceUpdate = null;
        
        this.initializeEventListeners();
        this.loadItemsAndRecipes();
        
        // Make this accessible globally
        window.forgeCalculator = this;
    }

    initializeEventListeners() {
        // Filter event listeners
        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });
        
        document.getElementById('sortBy').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });

        document.getElementById('refreshPrices').addEventListener('click', () => {
            this.refreshPrices();
        });
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
            console.log('Loading items.json...');
            const response = await fetch('../jsons/items.json');
            console.log('Items.json response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Items.json data loaded, success:', data.success);
            console.log('Total items in database:', data.items.length);
            
            // Create a map of item names to their IDs
            let processedCount = 0;
            data.items.forEach(item => {
                this.items.set(item.name, item.id);
                processedCount++;
                if (processedCount % 10000 === 0) {
                    console.log(`Processed ${processedCount} items...`);
                }
            });
            
            console.log(`Loaded ${this.items.size} items for ID lookup`);
            
            // Test a few specific items we need
            const testItems = ['Drill Motor', 'Treasurite', 'Golden Plate', 'Refined Diamond'];
            testItems.forEach(itemName => {
                const id = this.items.get(itemName);
                console.log(`Test lookup - ${itemName}: ${id}`);
            });
        } catch (error) {
            console.error('Error loading items:', error);
            throw new Error('Failed to load items database');
        }
    }

    getItemId(itemName) {
        // First try the loaded items map
        let itemId = this.items.get(itemName);
        if (itemId) {
            return itemId;
        }
        
        // Fallback for critical forge items
        const knownForgeItems = {
            'Drill Motor': 'DRILL_ENGINE',
            'Treasurite': 'TREASURITE',
            'Golden Plate': 'GOLDEN_PLATE',
            'Enchanted Iron Block': 'ENCHANTED_IRON_BLOCK',
            'Enchanted Redstone Block': 'ENCHANTED_REDSTONE_BLOCK',
            'Refined Diamond': 'REFINED_DIAMOND',
            'Refined Mithril': 'REFINED_MITHRIL',
            'Refined Titanium': 'REFINED_TITANIUM',
            'Refined Umber': 'REFINED_UMBER',
            'Refined Tungsten': 'REFINED_TUNGSTEN',
            'Bejeweled Handle': 'BEJEWELED_HANDLE',
            'Enchanted Diamond Block': 'ENCHANTED_DIAMOND_BLOCK',
            'Enchanted Mithril': 'ENCHANTED_MITHRIL',
            'Enchanted Titanium': 'ENCHANTED_TITANIUM',
            'Enchanted Umber': 'ENCHANTED_UMBER',
            'Enchanted Tungsten': 'ENCHANTED_TUNGSTEN',
            'Glacite Jewel': 'GLACITE_JEWEL',
            'Fuel Canister': 'FUEL_CANISTER',
            'Enchanted Coal Block': 'ENCHANTED_COAL_BLOCK',
            'Gemstone Mixture': 'GEMSTONE_MIXTURE',
            'Fine Jade Gemstone': 'FINE_JADE_GEMSTONE',
            'Fine Amber Gemstone': 'FINE_AMBER_GEMSTONE',
            'Fine Amethyst Gemstone': 'FINE_AMETHYST_GEMSTONE',
            'Fine Sapphire Gemstone': 'FINE_SAPPHIRE_GEMSTONE',
            'Sludge Juice': 'SLUDGE_JUICE',
            'Glacite Amalgamation': 'GLACITE_AMALGAMATION',
            'Fine Onyx Gemstone': 'FINE_ONYX_GEMSTONE',
            'Fine Citrine Gemstone': 'FINE_CITRINE_GEMSTONE',
            'Fine Peridot Gemstone': 'FINE_PERIDOT_GEMSTONE',
            'Fine Aquamarine Gemstone': 'FINE_AQUAMARINE_GEMSTONE',
            'Enchanted Glacite': 'ENCHANTED_GLACITE',
            'Enchanted Gold Block': 'ENCHANTED_GOLD_BLOCK',
            'Mithril Plate': 'MITHRIL_PLATE',
            'Tungsten Plate': 'TUNGSTEN_PLATE',
            'Umber Plate': 'UMBER_PLATE',
            'Perfect Plate': 'PERFECT_PLATE',
            'Mithril Drill SX-R226': 'MITHRIL_DRILL_SX-R226',
            'Mithril Drill SX-R326': 'MITHRIL_DRILL_SX-R326',
            'Ruby Drill TX-15': 'RUBY_DRILL_TX-15',
            'Fine Ruby Gemstone': 'FINE_RUBY_GEMSTONE',
            'Gemstone Drill LT-522': 'GEMSTONE_DRILL_LT-522',
            'Topaz Drill KGR-12': 'TOPAZ_DRILL_KGR-12',
            'Jasper Drill X': 'JASPER_DRILL_X',
            'Topaz Rod': 'TOPAZ_ROD',
            'Titanium Drill DR-X355': 'TITANIUM_DRILL_DR-X355',
            'Titanium Drill DR-X455': 'TITANIUM_DRILL_DR-X455',
            'Titanium Drill DR-X555': 'TITANIUM_DRILL_DR-X555',
            'Titanium Drill DR-X655': 'TITANIUM_DRILL_DR-X655',
            'Chisel': 'CHISEL',
            'Reinforced Chisel': 'REINFORCED_CHISEL',
            'Glacite-Plated Chisel': 'GLACITE_PLATED_CHISEL',
            'Perfect Chisel': 'PERFECT_CHISEL',
            "Divan's Drill": 'DIVANS_DRILL',
            "Divan's Alloy": 'DIVANS_ALLOY',
            'Flawless Topaz Gemstone': 'FLAWLESS_TOPAZ_GEMSTONE',
            'Flawless Jasper Gemstone': 'FLAWLESS_JASPER_GEMSTONE',
            'Flawless Ruby Gemstone': 'FLAWLESS_RUBY_GEMSTONE',
            'Magma Core': 'MAGMA_CORE',
            'Corleonite': 'CORLEONITE',
            'Plasma': 'PLASMA',
            'Tungsten': 'TUNGSTEN'
        };
        
        itemId = knownForgeItems[itemName];
        if (itemId) {
            console.log(`Using fallback ID for ${itemName}: ${itemId}`);
            return itemId;
        }
        
        console.warn(`Item ID not found for: ${itemName}`);
        return null;
    }

    async loadRecipes() {
        try {
            const response = await fetch('../jsons/forge-recipes.json');
            const data = await response.json();
            
            this.recipes = data.recipes;
            console.log(`Loaded ${this.recipes.length} forge recipes`);
            document.getElementById('recipeCountDisplay').textContent = this.recipes.length;
            
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
            console.log('=== STARTING PRICE LOADING ===');
            // Clear existing cache
            this.priceCache.clear();
            
            // Collect all items that need pricing with their specified sources
            const itemsToFetch = new Map(); // itemName -> {source, isOutput}
            
            this.recipes.forEach(recipe => {
                console.log(`Processing recipe: ${recipe.name}`);
                // Add input items with their specified sources (skip coin inputs)
                recipe.inputs.forEach(input => {
                    if (input.source !== 'coins') {
                        itemsToFetch.set(input.name, { source: input.source, isOutput: false });
                        console.log(`  Input: ${input.name} from ${input.source}`);
                    } else {
                        console.log(`  Skipping coin input: ${input.name} (${input.coinCost} coins)`);
                    }
                });
                
                // Add output item with its specified sell location
                itemsToFetch.set(recipe.name, { source: recipe.sellLocation, isOutput: true });
                console.log(`  Output: ${recipe.name} to ${recipe.sellLocation}`);
            });
            
            console.log('=== ITEMS TO FETCH ===');
            console.log('Items to fetch with sources:', Object.fromEntries(itemsToFetch));
            
            // Check if items are properly mapped to IDs
            console.log('=== CHECKING ITEM ID MAPPINGS ===');
            for (const [itemName, {source, isOutput}] of itemsToFetch) {
                const itemId = this.getItemId(itemName);
                console.log(`${itemName} -> ${itemId} (${source}, ${isOutput ? 'output' : 'input'})`);
            }
            
            // Fetch prices for all items from their specified locations only
            const pricePromises = Array.from(itemsToFetch).map(async ([itemName, {source, isOutput}]) => {
                try {
                    console.log(`=== FETCHING PRICE FOR ${itemName} ===`);
                    const price = await this.getItemPriceFromSource(itemName, source, isOutput);
                    console.log(`=== PRICE RESULT FOR ${itemName}: ${price} ===`);
                    this.priceCache.set(itemName, price);
                } catch (error) {
                    console.warn(`Failed to get price for ${itemName} from ${source}:`, error);
                    this.priceCache.set(itemName, 0);
                }
            });
            
            await Promise.allSettled(pricePromises);
            
            console.log('=== FINAL PRICE CACHE ===');
            console.log('Price cache contents:', Object.fromEntries(this.priceCache));
            
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
        console.log(`=== GET PRICE FROM SOURCE: ${itemName} ===`);
        
        // Handle raw coin inputs
        if (source === 'coins') {
            console.log(`Using raw coin cost for ${itemName}`);
            return 0; // We'll handle this in the input processing
        }
        
        const itemId = this.getItemId(itemName);
        if (!itemId) {
            console.error(`Cannot get price for ${itemName}: Item ID not found in items.json`);
            console.log('Available items in map (first 10):', Array.from(this.items.keys()).slice(0, 10));
            return 0;
        }
        
        console.log(`Item ID for ${itemName}: ${itemId}`);
        
        try {
            console.log(`Getting price for ${itemName} (ID: ${itemId}) from ${source}`);
            
            if (source === 'bazaar') {
                console.log('Calling bazaar API...');
                // Get the full bazaar data for this item
                const products = await this.bazaarAPI.fetchBazaarData();
                console.log('Bazaar data fetched, checking for item...');
                const product = products[itemId];
                
                if (!product) {
                    console.warn(`${itemName} (${itemId}) not found in bazaar`);
                    console.log('Available products (first 10):', Object.keys(products).slice(0, 10));
                    return 0;
                }
                
                console.log(`Found product for ${itemName}:`, {
                    hasBuySummary: !!product.buy_summary,
                    buySummaryLength: product.buy_summary?.length || 0,
                    hasSellSummary: !!product.sell_summary,
                    sellSummaryLength: product.sell_summary?.length || 0
                });
                
                let price = 0;
                
                if (isOutput) {
                    // For outputs, we want to sell - use buy orders (what players will pay us)
                    if (product.buy_summary && product.buy_summary.length > 0) {
                        price = product.buy_summary[0].pricePerUnit;
                        console.log(`Found ${itemName} sell price in bazaar: ${price}`);
                    } else {
                        console.log(`No buy orders for ${itemName}`);
                    }
                } else {
                    // For inputs, we want to buy - use sell orders (what players are selling for)
                    if (product.sell_summary && product.sell_summary.length > 0) {
                        price = product.sell_summary[0].pricePerUnit;
                        console.log(`Found ${itemName} buy price in bazaar: ${price}`);
                    } else {
                        console.log(`No sell orders for ${itemName}`);
                    }
                }
                
                if (price === 0) {
                    console.warn(`No ${isOutput ? 'buy orders' : 'sell orders'} for ${itemName} in bazaar`);
                }
                
                return price;
                
            } else if (source === 'auction') {
                console.log('Calling auction API...');
                // For auction house, use the item ID
                const price = await this.coflnetAPI.getLowestBIN(itemId);
                if (price > 0) {
                    console.log(`Found ${itemName} in auction house: ${price}`);
                    return price;
                }
                console.warn(`No auction price found for ${itemName}`);
                return 0;
            } else {
                console.error(`Unknown source: ${source} for item ${itemName}`);
                return 0;
            }
        } catch (error) {
            console.error(`Error getting ${source} price for ${itemName}:`, error);
            return 0;
        }
    }

    calculateRecipeProfit(recipe) {
        // Calculate input costs
        let inputCost = 0;
        const inputDetails = [];

        recipe.inputs.forEach(input => {
            let price = 0;
            let totalCost = 0;
            
            if (input.source === 'coins') {
                // Handle raw coin inputs
                price = input.coinCost || 0;
                totalCost = price * input.quantity;
                console.log(`Using coin cost for ${input.name}: ${price} each, total: ${totalCost}`);
            } else {
                // Handle regular market-priced inputs
                price = this.priceCache.get(input.name) || 0;
                totalCost = price * input.quantity;
                console.log(`Calculating cost for ${input.name}: ${price} each, total: ${totalCost}`);
            }
            
            inputCost += totalCost;
            inputDetails.push({
                ...input,
                unitPrice: price,
                totalCost: totalCost
            });
        });

        // Calculate output value
        const outputPrice = this.priceCache.get(recipe.name) || 0;
        console.log(`Output price for ${recipe.name}: ${outputPrice}`);
        console.log(`Final calculation - Input cost: ${inputCost}, Output value: ${outputPrice}`);

        // Calculate profit and profit per hour
        const profit = outputPrice - inputCost;
        const totalHours = recipe.time.hours + (recipe.time.minutes / 60);
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
        
        console.log(`Filtering by category: ${categoryFilter}, sorting by: ${sortBy}`);
        
        // Filter recipes by category
        let filteredRecipes = this.recipes;
        if (categoryFilter !== 'all') {
            filteredRecipes = this.recipes.filter(recipe => recipe.category === categoryFilter);
        }
        
        console.log(`Filtered recipes count: ${filteredRecipes.length}`);

        // Calculate profits for filtered recipes
        const recipesWithData = filteredRecipes.map(recipe => ({
            ...recipe,
            calculation: this.calculateRecipeProfit(recipe)
        }));

        // Sort recipes
        recipesWithData.sort((a, b) => {
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

        this.displayRecipes(recipesWithData);
        this.updateSummary(recipesWithData);
    }

    displayRecipes(recipes) {
        const grid = document.getElementById('recipesGrid');
        
        if (recipes.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: #94a3b8;">No recipes found for the selected filters.</p>';
            return;
        }

        grid.innerHTML = recipes.map(recipe => {
            const calc = recipe.calculation;
            const profitClass = calc.profit > 0 ? 'profit-positive' : calc.profit < 0 ? 'profit-negative' : 'profit-neutral';
            const statusClass = calc.profit > 0 ? 'status-profitable' : calc.profit < 0 ? 'status-unprofitable' : 'status-break-even';
            
            const timeText = recipe.time.hours > 0 ? 
                `${recipe.time.hours}h ${recipe.time.minutes}m` : 
                `${recipe.time.minutes}m`;

            return `
                <div class="recipe-card ${statusClass}">
                    <div class="recipe-header">
                        <div class="recipe-name">${recipe.name}</div>
                        <div class="recipe-category">${recipe.category}</div>
                        <div class="recipe-time">⏱️ ${timeText}</div>
                    </div>
                    
                    <div class="recipe-materials">
                        ${calc.inputDetails.map(input => `
                            <div class="material-item">
                                <span class="material-name">${input.quantity}x ${input.name}</span>
                                <span class="material-cost">${
                                    input.source === 'coins' 
                                        ? `${this.formatCoins(input.unitPrice)}`
                                        : `${this.formatCoins(input.unitPrice)} each`
                                }</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="recipe-summary">
                        <div class="cost-summary">
                            <span class="label">Cost:</span>
                            <span class="value">${this.formatCoins(calc.inputCost)}</span>
                        </div>
                        <div class="sell-summary">
                            <span class="label">Sells for:</span>
                            <span class="value">${this.formatCoins(calc.outputValue)}</span>
                        </div>
                    </div>
                    
                    <div class="profit-highlight">
                        <div class="hourly-profit">
                            <div class="profit-label">Per Hour</div>
                            <div class="profit-amount ${profitClass}">${this.formatCoins(calc.profitPerHour)}</div>
                        </div>
                        <div class="total-profit">
                            <div class="profit-label">Total Profit</div>
                            <div class="profit-amount ${profitClass}">${this.formatCoins(calc.profit)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateSummary(recipes) {
        if (recipes.length === 0) {
            document.getElementById('bestProfitDisplay').textContent = 'No data';
            document.getElementById('bestProfitPerHourDisplay').textContent = 'No data';
            return;
        }

        const bestProfit = Math.max(...recipes.map(r => r.calculation.profit));
        const bestProfitPerHour = Math.max(...recipes.map(r => r.calculation.profitPerHour));

        document.getElementById('bestProfitDisplay').textContent = this.formatCoins(bestProfit);
        document.getElementById('bestProfitPerHourDisplay').textContent = this.formatCoins(bestProfitPerHour);
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
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    async refreshPrices() {
        this.priceCache.clear();
        await this.loadPrices();
        this.filterAndSortRecipes();
    }

    showError(message) {
        const grid = document.getElementById('recipesGrid');
        grid.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 40px;">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">
                    Reload Page
                </button>
            </div>
        `;
        grid.style.display = 'block';
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize the calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.forgeCalculator = new ForgeCalculator();
    console.log('Forge Calculator initialized');
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForgeCalculator;
}