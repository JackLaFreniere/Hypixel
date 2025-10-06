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
        this.priceCache = new Map();
        this.lastPriceUpdate = null;
        
        this.initializeEventListeners();
        this.loadRecipes();
        
        // Make this accessible globally
        window.forgeCalculator = this;
    }

    initializeEventListeners() {
        // Filter event listeners
        document.getElementById('sortBy').addEventListener('change', () => {
            this.filterAndSortRecipes();
        });

        document.getElementById('refreshPrices').addEventListener('click', () => {
            this.refreshPrices();
        });
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
            // Clear existing cache
            this.priceCache.clear();
            
            // Collect all unique items that need pricing
            const allItems = new Set();
            
            this.recipes.forEach(recipe => {
                // Add input items
                recipe.inputs.forEach(input => {
                    allItems.add(input.name);
                });
                
                // Add output item
                allItems.add(recipe.name);
            });
            
            console.log('Items to fetch prices for:', Array.from(allItems));
            
            // Fetch prices for all items
            const pricePromises = Array.from(allItems).map(async (itemName) => {
                try {
                    const price = await this.getItemPrice(itemName);
                    console.log(`Price for ${itemName}:`, price);
                    this.priceCache.set(itemName, price);
                } catch (error) {
                    console.warn(`Failed to get price for ${itemName}:`, error);
                    this.priceCache.set(itemName, 0);
                }
            });
            
            await Promise.allSettled(pricePromises);
            
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

    async getItemPrice(itemName) {
        try {
            // Try bazaar first
            const bazaarPrice = await this.bazaarAPI.getItemPriceByName(itemName);
            if (bazaarPrice > 0) {
                console.log(`Found ${itemName} in bazaar: ${bazaarPrice}`);
                return bazaarPrice;
            }
            
            // If not available in bazaar, try auction house
            console.log(`${itemName} not found in bazaar, trying auction house...`);
            const auctionPrice = await this.coflnetAPI.getLowestBIN(itemName);
            if (auctionPrice > 0) {
                console.log(`Found ${itemName} in auction house: ${auctionPrice}`);
                return auctionPrice;
            }
            
            console.warn(`No price found for ${itemName}`);
            return 0;
            
        } catch (error) {
            console.error(`Error getting price for ${itemName}:`, error);
            return 0;
        }
    }

    calculateRecipeProfit(recipe) {
        // Calculate input costs
        let inputCost = 0;
        const inputDetails = [];

        recipe.inputs.forEach(input => {
            const price = this.priceCache.get(input.name) || 0;
            
            console.log(`Calculating cost for ${input.name}: ${price}`);
            
            const itemCost = price * input.quantity;
            inputCost += itemCost;
            inputDetails.push({
                ...input,
                unitPrice: price,
                totalCost: itemCost
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
        const sortBy = document.getElementById('sortBy').value;

        // Calculate profits for all recipes
        const recipesWithData = this.recipes.map(recipe => ({
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
                        <div class="recipe-time">⏱️ ${timeText}</div>
                    </div>
                    
                    <div class="recipe-materials">
                        ${calc.inputDetails.map(input => `
                            <div class="material-item">
                                <span class="material-name">${input.quantity}x ${input.name}</span>
                                <span class="material-cost">${this.formatCoins(input.totalCost)}</span>
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