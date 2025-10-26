/**
 * Price API Manager
 * 
 * Unified API for fetching Hypixel Skyblock item prices from both bazaar and auction house.
 * - Bazaar prices: Fetched from Hypixel API
 * - Auction prices: Fetched from Coflnet API
 * 
 * Usage:
 * const priceAPI = new PriceAPI();
 * await priceAPI.initialize();
 * const price = await priceAPI.getPrice('HYPERION', 'auction');
 */
class PriceAPI {
    constructor() {
        this.baseURL = 'https://sky.coflnet.com/api';
        
        // Separate caches for bazaar and auction prices
        this.bazaarPrices = {};
        this.auctionPrices = {};
        this.lastBazaarFetch = 0;
        this.lastAuctionFetch = 0;
        this.cacheExpiry = 60000; // 1 minute cache for auto-refresh
        this.autoRefreshInterval = null;
        
        // Items database for name-to-tag conversion
        this.itemsDatabase = null;
        this.itemsDatabaseLoaded = false;
        
        // Status tracking
        this.isInitialized = false;
        this.lastError = null;
    }

    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            await this.loadItemsDatabase();
            // Load initial price data (always fresh fetch)
            await this.loadAllPrices();
            this.isInitialized = true;
            return true;
        } catch (error) {
            this.lastError = error;
            return false;
        }
    }
    
    /**
     * Fetch all bazaar prices directly from Hypixel API
     * (Coflnet doesn't have a bazaar bulk endpoint)
     */
    async fetchBazaarPrices() {
        const now = Date.now();
        
        console.log('⟳ Fetching bazaar prices from Hypixel API...');
        
        try {
            // Use Hypixel's direct bazaar API
            const response = await fetch('https://api.hypixel.net/skyblock/bazaar');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.products) {
                throw new Error('Invalid bazaar response');
            }
            
            const priceMap = {};
            
            // Parse Hypixel bazaar response
            for (const [itemId, product] of Object.entries(data.products)) {
                // Use buy orders (instant sell price) as the primary price
                if (product.buy_summary && product.buy_summary.length > 0) {
                    priceMap[itemId] = product.buy_summary[0].pricePerUnit;
                }
                // Fallback to sell orders (instant buy price)
                else if (product.sell_summary && product.sell_summary.length > 0) {
                    priceMap[itemId] = product.sell_summary[0].pricePerUnit;
                } else {
                    priceMap[itemId] = 0;
                }
            }
            
            this.bazaarPrices = priceMap;
            this.lastBazaarFetch = now;
            
            console.log(`✓ Cached ${Object.keys(priceMap).length} bazaar items from Hypixel`);
            
            return priceMap;
            
        } catch (error) {
            console.error('Failed to fetch bazaar prices from Hypixel:', error);
            this.bazaarPrices = {};
            return {};
        }
    }
    
    /**
     * Fetch all auction prices from Coflnet using their items endpoint
     */
    async fetchAuctionPrices() {
        const now = Date.now();
        
        console.log('⟳ Fetching auction prices from Coflnet...');
        
        try {
            // Coflnet's items endpoint gives us a list of all items
            const response = await fetch(`${this.baseURL}/items`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const items = await response.json();
            const priceMap = {};
            
            // For each item, we'll need to get its price
            // But we'll do this on-demand to avoid too many requests
            // For now, just store the item list
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (item.tag) {
                        priceMap[item.tag] = null; // Will be fetched on-demand
                    }
                });
            }
            
            this.auctionPrices = priceMap;
            this.lastAuctionFetch = now;
            
            console.log(`✓ Loaded ${Object.keys(priceMap).length} auction item tags from Coflnet (prices on-demand)`);
            
            return priceMap;
            
        } catch (error) {
            console.error('Failed to fetch auction items from Coflnet:', error);
            this.auctionPrices = {};
            return {};
        }
    }
    
    /**
     * Load all prices - always fetch fresh on page load
     */
    async loadAllPrices() {
        // Always fetch fresh data on initialization (no localStorage caching)
        console.log('⟳ Fetching fresh price data on page load...');
        await this.fetchBazaarPrices();
        await this.fetchAuctionPrices();
    }

    async loadItemsDatabase() {
        if (this.itemsDatabaseLoaded) {
            return;
        }

        try {
            const response = await fetch('../jsons/items.json');
            if (!response.ok) {
                throw new Error(`Failed to load items.json: ${response.status}`);
            }
            const data = await response.json();
            this.itemsDatabase = data.items || data;
            this.itemsDatabaseLoaded = true;
        } catch (error) {
            throw error;
        }
    }

    findItemTag(itemName) {
        const item = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (item && item.id) {
            return item.id;
        }
        
        return null;
    }

    /**
     * Get price for an item (checks bazaar first, then auction)
     * @param {string} itemName - Item name or tag
     * @param {string} source - 'bazaar' or 'auction' (optional, will check both if not specified)
     * @returns {Promise<number>} Price in coins
     */
    async getPrice(itemName, source = null) {
        try {
            // Ensure we have price data
            if (!this.bazaarPrices) {
                await this.loadAllPrices();
            }
            
            const itemTag = itemName.includes('_') ? itemName : this.findItemTag(itemName);
            
            if (!itemTag) {
                return 0;
            }
            
            // If source is specified, check only that source
            if (source === 'bazaar') {
                return this.bazaarPrices[itemTag] || 0;
            }
            
            if (source === 'auction') {
                return await this.getAuctionPrice(itemTag);
            }
            
            // Check bazaar first (faster, more reliable)
            if (this.bazaarPrices[itemTag]) {
                return this.bazaarPrices[itemTag];
            }
            
            // Fall back to auction price
            return await this.getAuctionPrice(itemTag);
            
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Get auction price for a specific item
     * @param {string} itemTag - Item tag
     * @returns {Promise<number>} Price in coins
     */
    async getAuctionPrice(itemTag) {
        try {
            // Check if we need to refresh
            const now = Date.now();
            if (now - this.lastAuctionFetch > this.cacheExpiry) {
                await this.fetchAuctionPrices();
            }
            
            // Get price from cache if available
            const cachedPrice = this.auctionPrices[itemTag];
            
            if (cachedPrice !== undefined && cachedPrice !== null && cachedPrice !== 0) {
                return cachedPrice;
            }
            
            // Fetch individual item price
            try {
                const url = `${this.baseURL}/item/price/${itemTag}/current`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    // Coflnet returns buy/sell prices, use buy price (lowest BIN equivalent)
                    const itemPrice = data.buy || data.sell || data.lbin || data.median || data.mean || 0;
                    
                    // Update cache with new price
                    this.auctionPrices[itemTag] = itemPrice;
                    
                    return itemPrice;
                } else {
                    console.warn(`Failed to fetch auction price for ${itemTag}: HTTP ${response.status}`);
                }
            } catch (fetchError) {
                console.error(`Error fetching auction price for ${itemTag}:`, fetchError);
            }
            
            return 0;
            
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Alias for getPrice (for backwards compatibility)
     */
    async getLowestBIN(itemName) {
        return await this.getPrice(itemName, 'auction');
    }
    
    /**
     * Get item price from bazaar (for backwards compatibility)
     */
    async getItemPrice(itemId) {
        return await this.getPrice(itemId, 'bazaar');
    }

    /**
     * Get all prices (combined bazaar and auction)
     * @returns {Promise<Object>} Object with item tags as keys and prices as values
     */
    async getAllPrices() {
        if (!this.bazaarPrices || !this.auctionPrices) {
            await this.loadAllPrices();
        }
        
        // Check if we need to refresh
        const now = Date.now();
        if (now - this.lastBazaarFetch > this.cacheExpiry) {
            await this.fetchBazaarPrices();
        }
        if (now - this.lastAuctionFetch > this.cacheExpiry) {
            await this.fetchAuctionPrices();
        }
        
        // Combine both (bazaar takes priority)
        return {
            ...this.auctionPrices,
            ...this.bazaarPrices
        };
    }
    
    /**
     * Start auto-refresh of both bazaar and auction data
     * @param {number} intervalMs - Refresh interval in milliseconds (default: 60000 = 1 minute)
     */
    startAutoRefresh(intervalMs = 60000) {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(async () => {
            try {
                await this.fetchBazaarPrices();
                await this.fetchAuctionPrices();
                console.log('✓ Auto-refreshed bazaar (Hypixel) and auction (Coflnet) data');
            } catch (error) {
                console.error('Failed to auto-refresh data:', error);
            }
        }, intervalMs);
        
        console.log(`✓ Coflnet auto-refresh enabled (every ${intervalMs / 1000}s)`);
    }
    
    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('✓ Coflnet auto-refresh stopped');
        }
    }



    clearCache() {
        this.bazaarPrices = null;
        this.auctionPrices = null;
        this.lastBazaarFetch = 0;
        this.lastAuctionFetch = 0;
    }
    
    /**
     * Force refresh - bypasses cache
     */
    async forceRefresh() {
        this.bazaarPrices = null;
        this.auctionPrices = null;
        this.lastBazaarFetch = 0;
        this.lastAuctionFetch = 0;
        await this.fetchBazaarPrices();
        await this.fetchAuctionPrices();
    }

    /**
     * Get API status information
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            bazaarItems: this.bazaarPrices ? Object.keys(this.bazaarPrices).length : 0,
            auctionItems: this.auctionPrices ? Object.keys(this.auctionPrices).length : 0,
            lastBazaarFetch: new Date(this.lastBazaarFetch).toLocaleTimeString(),
            lastAuctionFetch: new Date(this.lastAuctionFetch).toLocaleTimeString(),
            lastError: this.lastError
        };
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.PriceAPI = PriceAPI;
    
    // Create global instance
    if (!window.globalPriceAPI) {
        window.globalPriceAPI = new PriceAPI();
    }
}