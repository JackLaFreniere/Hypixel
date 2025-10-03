/**
 * Shared Gemstone Pricing Utility
 * Provides unified access to gemstone and crystal pricing data
 * Can be used by both crystal calculator and corpse ROI calculator
 */
class GemstonePricing {
    constructor() {
        this.bazaarAPI = null;
        this.coflnetAPI = null;
        this.initialized = false;
        
        // Define all 12 gemstone types for Hypixel Skyblock
        this.gemstones = [
            'amber', 'amethyst', 'jade', 'sapphire', 'ruby', 'topaz',
            'jasper', 'opal', 'aquamarine', 'citrine', 'onyx', 'peridot'
        ];
        
        // Gemstone conversion ratios
        this.normalPerFlawed = 80; // 1 flawed = 80 normal gemstones
        this.normalPerFine = 6400; // 1 fine = 6400 normal gemstones
        this.normalPerPerfect = 2560000; // 1 perfect = 2,560,000 normal gemstones
        
        // Cached price data
        this.priceCache = {};
        this.cacheTimestamp = 0;
        this.cacheValidDuration = 5 * 60 * 1000; // 5 minutes
        
        console.log('GemstonePricing utility initialized');
    }
    
    /**
     * Initialize with API instances
     */
    initialize(bazaarAPI, coflnetAPI) {
        this.bazaarAPI = bazaarAPI;
        this.coflnetAPI = coflnetAPI;
        this.initialized = true;
        console.log('GemstonePricing APIs set');
    }
    
    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        return (Date.now() - this.cacheTimestamp) < this.cacheValidDuration;
    }
    
    /**
     * Get all gemstone prices (flawed, fine, perfect, crystal)
     */
    async getAllGemstonePrices() {
        if (!this.initialized) {
            throw new Error('GemstonePricing not initialized with APIs');
        }
        
        // Return cached data if still valid
        if (this.isCacheValid() && Object.keys(this.priceCache).length > 0) {
            console.log('Returning cached gemstone prices');
            return this.priceCache;
        }
        
        console.log('Fetching fresh gemstone prices...');
        const prices = {};
        
        for (const gemstone of this.gemstones) {
            prices[gemstone] = await this.getGemstoneAllPrices(gemstone);
        }
        
        // Cache the results
        this.priceCache = prices;
        this.cacheTimestamp = Date.now();
        
        return prices;
    }
    
    /**
     * Get all price types for a specific gemstone
     */
    async getGemstoneAllPrices(gemstone) {
        const prices = {};
        
        try {
            // Get flawed gemstone price (bazaar)
            const flawedItem = `FLAWED_${gemstone.toUpperCase()}_GEM`;
            prices.flawed = await this.bazaarAPI.getItemPriceByName(flawedItem);
            
            // Get fine gemstone price (bazaar)
            const fineItem = `FINE_${gemstone.toUpperCase()}_GEM`;
            prices.fine = await this.bazaarAPI.getItemPriceByName(fineItem);
            
            // Get perfect gemstone price (auction)
            const perfectItem = `PERFECT_${gemstone.toUpperCase()}_GEM`;
            prices.perfect = await this.coflnetAPI.getLowestBIN(perfectItem);
            
            // Try multiple crystal naming conventions
            prices.crystal = await this.getCrystalPriceWithFallbacks(gemstone);
            
            console.log(`Prices for ${gemstone}:`, prices);
            
        } catch (error) {
            console.error(`Error fetching prices for ${gemstone}:`, error);
            prices.flawed = 0;
            prices.fine = 0;
            prices.perfect = 0;
            prices.crystal = 0;
        }
        
        return prices;
    }
    
    /**
     * Try multiple naming conventions for crystal items
     */
    async getCrystalPriceWithFallbacks(gemstone) {
        const possibleNames = [
            `${gemstone.toUpperCase()}_CRYSTAL`,
            `${gemstone.toUpperCase()}_CRYSTAL_FRAGMENT`,
            `SKYBLOCK_ITEMS_${gemstone.toUpperCase()}_CRYSTAL`,
            `${gemstone.charAt(0).toUpperCase() + gemstone.slice(1)} Crystal`,
            `${gemstone.toUpperCase()}_SHARD`
        ];
        
        for (const name of possibleNames) {
            try {
                console.log(`Trying crystal name: ${name}`);
                const price = await this.coflnetAPI.getLowestBIN(name);
                if (price > 0) {
                    console.log(`Found crystal price for ${name}: ${price}`);
                    return price;
                }
            } catch (error) {
                console.log(`Failed to get price for ${name}:`, error.message);
            }
        }
        
        // If no crystal price found, crystals might not be tradeable
        // Return 0 or calculate based on perfect gem value
        console.log(`No crystal price found for ${gemstone}, crystals may not be tradeable`);
        return 0;
    }
    
    /**
     * Get specific gemstone type price
     */
    async getGemstonePrice(gemstone, type) {
        if (!this.initialized) {
            throw new Error('GemstonePricing not initialized with APIs');
        }
        
        // Check cache first
        if (this.isCacheValid() && this.priceCache[gemstone] && this.priceCache[gemstone][type]) {
            return this.priceCache[gemstone][type];
        }
        
        // Fetch specific price
        try {
            let itemName;
            let api;
            
            switch (type) {
                case 'flawed':
                    itemName = `FLAWED_${gemstone.toUpperCase()}_GEM`;
                    api = this.bazaarAPI;
                    return await api.getItemPriceByName(itemName);
                    
                case 'fine':
                    itemName = `FINE_${gemstone.toUpperCase()}_GEM`;
                    api = this.bazaarAPI;
                    return await api.getItemPriceByName(itemName);
                    
                case 'perfect':
                    itemName = `PERFECT_${gemstone.toUpperCase()}_GEM`;
                    return await this.bazaarAPI.getItemPriceByName(itemName);

                case 'crystal':
                    // Crystals don't exist as tradeable items - calculate value as profit from crystal usage
                    // This replicates the crystal calculator's profit calculation logic
                    try {
                        const gemstoneUpper = gemstone.toUpperCase();
                        console.log(`Calculating crystal value for ${gemstone}...`);
                        
                        // Get prices for all gemstone types needed for calculation - ALL from bazaar
                        const flawedPrice = await this.bazaarAPI.getItemPriceByName(`FLAWED_${gemstoneUpper}_GEM`);
                        const finePrice = await this.bazaarAPI.getItemPriceByName(`FINE_${gemstoneUpper}_GEM`);
                        const perfectPrice = await this.bazaarAPI.getItemPriceByName(`PERFECT_${gemstoneUpper}_GEM`);
                        
                        console.log(`${gemstone} prices: flawed=${flawedPrice}, fine=${finePrice}, perfect=${perfectPrice}`);
                        
                        if (perfectPrice <= 0) {
                            console.log(`No perfect gemstone price found for ${gemstone}, crystal value = 0`);
                            return 0;
                        }
                        
                        // Crystal calculator constants
                        const normalPerFlawed = 80;
                        const normalPerFine = 6400; 
                        const normalPerPerfect = 2560000;
                        const flawedNeededForPerfect = normalPerPerfect / normalPerFlawed; // 32,000
                        const fineNeededForPerfect = normalPerPerfect / normalPerFine; // 400
                        
                        // Calculate total cost to make 1 perfect gemstone via each method
                        const flawedTotalCost = flawedPrice * flawedNeededForPerfect;
                        const fineTotalCost = finePrice * fineNeededForPerfect;
                        
                        console.log(`${gemstone} costs: flawed total=${flawedTotalCost}, fine total=${fineTotalCost}`);
                        
                        // Determine best method (lowest cost)
                        let bestCost = 0;
                        if (flawedTotalCost > 0 && fineTotalCost > 0) {
                            bestCost = Math.min(flawedTotalCost, fineTotalCost);
                        } else if (flawedTotalCost > 0) {
                            bestCost = flawedTotalCost;
                        } else if (fineTotalCost > 0) {
                            bestCost = fineTotalCost;
                        }
                        
                        // Crystal value = profit from using it (perfect gem price - input cost)
                        const crystalValue = bestCost > 0 ? perfectPrice - bestCost : 0;
                        console.log(`Crystal value for ${gemstone}: ${perfectPrice} - ${bestCost} = ${crystalValue}`);
                        return Math.max(0, crystalValue); // Don't return negative values
                        
                    } catch (error) {
                        console.error(`Error calculating crystal value for ${gemstone}:`, error);
                        return 0;
                    }
                    
                default:
                    throw new Error(`Unknown gemstone type: ${type}`);
            }
        } catch (error) {
            console.error(`Error fetching ${type} ${gemstone} price:`, error);
            return 0;
        }
    }
    
    /**
     * Calculate crystal conversion value
     * Each crystal gives 25 perfect gemstones
     */
    calculateCrystalValue(gemstone, crystalPrice, perfectPrice) {
        const perfectGemsPerCrystal = 25;
        const valueFromPerfects = perfectPrice * perfectGemsPerCrystal;
        const profit = valueFromPerfects - crystalPrice;
        return {
            crystalPrice,
            perfectPrice,
            perfectGemsPerCrystal,
            valueFromPerfects,
            profit,
            profitable: profit > 0
        };
    }
    
    /**
     * Get formatted price string
     */
    formatPrice(price) {
        if (price >= 1000000) {
            return (price / 1000000).toFixed(1) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'K';
        } else {
            return Math.round(price).toLocaleString();
        }
    }
    
    /**
     * Get gemstone names list
     */
    getGemstoneList() {
        return [...this.gemstones];
    }
    
    /**
     * Clear cache to force refresh
     */
    clearCache() {
        this.priceCache = {};
        this.cacheTimestamp = 0;
        console.log('Gemstone price cache cleared');
    }
}

// Make it globally available
window.GemstonePricing = GemstonePricing;