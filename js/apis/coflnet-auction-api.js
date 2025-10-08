/**
 * Coflnet Auction API Manager
 * 
 * This class uses the Coflnet API (sky.coflnet.com) which provides reliable
 * auction house data without CORS issues. It's specifically designed for
 * Hypixel Skyblock auction data and is much more stable than direct Hypixel API calls.
 * 
 * Usage:
 * const coflnetAPI = new CoflnetAuctionAPI();
 * await coflnetAPI.initialize();
 * const lowestBin = await coflnetAPI.getLowestBIN('HYPERION');
 */
class CoflnetAuctionAPI {
    constructor() {
        this.baseURL = 'https://sky.coflnet.com/api';
        
        // Caching system
        this.cache = new Map();
        this.cacheExpiry = 300000; // 5 minutes
        this.rateLimitDelay = 250; // 250ms between requests to be respectful
        this.lastRequest = 0;
        
        // Items database for name-to-tag conversion
        this.itemsDatabase = null;
        this.itemsDatabaseLoaded = false;
        
        // Status tracking
        this.isInitialized = false;
        this.connectionStatus = 'disconnected';
        this.lastError = null;
    }

    /**
     * Initialize the API manager by loading the items database
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log('Initializing Coflnet Auction API...');
            await this.loadItemsDatabase();
            this.isInitialized = true;
            console.log('Coflnet Auction API initialized successfully');
            return true;
        } catch (error) {
            this.lastError = error;
            console.error('Failed to initialize Coflnet Auction API:', error);
            return false;
        }
    }

    /**
     * Load the items database for name-to-tag conversion
     * @private
     */
    async loadItemsDatabase() {
        if (this.itemsDatabaseLoaded) {
            return;
        }

        try {
            console.log('Loading items database for Coflnet API...');
            const response = await fetch('../jsons/items.json');
            if (!response.ok) {
                throw new Error(`Failed to load items.json: ${response.status}`);
            }
            const data = await response.json();
            this.itemsDatabase = data.items || data;
            this.itemsDatabaseLoaded = true;
            console.log(`Loaded ${this.itemsDatabase.length} items for Coflnet lookup`);
        } catch (error) {
            console.error('Failed to load items database for Coflnet API:', error);
            throw error;
        }
    }

    /**
     * Find the item tag (ID) for a given item name
     * @param {string} itemName - The display name of the item
     * @returns {string} The item tag for API calls
     */
    findItemTag(itemName) {
        const item = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (item && item.id) {
            console.log(`Found item: ${itemName} -> ${item.id}`);
            return item.id;
        }
    }

    /**
     * Rate limiting helper
     * @private
     */
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequest = Date.now();
    }

    /**
     * Get the lowest BIN (Buy It Now) price for an item
     * @param {string} itemName - Item name or tag
     * @returns {Promise<number>} Lowest BIN price (0 if not found)
     */
    async getLowestBIN(itemName) {
        try {
            const itemTag = itemName.includes('_') ? itemName : this.findItemTag(itemName);
            const cacheKey = `bin_${itemTag}`;
            
            console.log(`Looking up BIN price for "${itemName}" -> tag: "${itemTag}"`);
            
            // Check cache first
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                console.log(`Using cached BIN price for ${itemName}: ${cached}`);
                return cached;
            }
            
            await this.rateLimit();
            
            const url = `${this.baseURL}/auctions/tag/${itemTag}/active/bin`;
            console.log(`Fetching BIN data from Coflnet: ${url}`);
            
            const response = await fetch(url);
            console.log(`Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`No BIN auctions found for ${itemName} (${itemTag}) - 404 response`);
                    // Try alternative API endpoint
                    const altUrl = `${this.baseURL}/item/${itemTag}/price`;
                    console.log(`Trying alternative endpoint: ${altUrl}`);
                    
                    const altResponse = await fetch(altUrl);
                    if (altResponse.ok) {
                        const altData = await altResponse.json();
                        const price = altData.median || altData.mean || 0;
                        console.log(`Alternative API returned price: ${price}`);
                        this.setCached(cacheKey, price);
                        return price;
                    }
                    
                    this.setCached(cacheKey, 0);
                    return 0;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`API response data:`, data);
            
            if (!Array.isArray(data) || data.length === 0) {
                console.warn(`No BIN auctions available for ${itemName}`);
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            // Get the lowest price (first item should be lowest)
            const lowestPrice = data[0].startingBid || data[0].highestBidAmount || 0;
            
            console.log(`Found ${data.length} BIN auctions for ${itemName}, lowest: ${lowestPrice} coins`);
            this.setCached(cacheKey, lowestPrice);
            
            return lowestPrice;
            
        } catch (error) {
            console.error(`Error getting BIN price for ${itemName}:`, error);
            return 0;
        }
    }

    /**
     * Get average BIN price for an item
     * @param {string} itemName - Item name or tag
     * @returns {Promise<number>} Average BIN price (0 if not found)
     */
    async getAverageBIN(itemName) {
        try {
            const itemTag = itemName.includes('_') ? itemName : this.findItemTag(itemName);
            const cacheKey = `avg_bin_${itemTag}`;
            
            // Check cache first
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                console.log(`Using cached average BIN price for ${itemName}: ${cached}`);
                return cached;
            }
            
            await this.rateLimit();
            
            const url = `${this.baseURL}/auctions/tag/${itemTag}/active/bin`;
            console.log(`Fetching BIN data for average from Coflnet: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`No BIN auctions found for ${itemName} (${itemTag})`);
                    this.setCached(cacheKey, 0);
                    return 0;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                console.warn(`No BIN auctions available for ${itemName}`);
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            // Calculate average from available auctions
            const prices = data.map(auction => auction.startingBid || auction.highestBidAmount || 0);
            const validPrices = prices.filter(price => price > 0);
            
            if (validPrices.length === 0) {
                console.warn(`No valid prices found for ${itemName}`);
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            const averagePrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
            
            console.log(`Found ${validPrices.length} valid BIN prices for ${itemName}, average: ${Math.round(averagePrice)} coins`);
            this.setCached(cacheKey, Math.round(averagePrice));
            
            return Math.round(averagePrice);
            
        } catch (error) {
            console.error(`Error getting average BIN price for ${itemName}:`, error);
            return 0;
        }
    }

    /**
     * Get multiple BIN prices efficiently
     * @param {string[]} itemNames - Array of item names
     * @returns {Promise<Map<string, number>>} Map of item names to prices
     */
    async getMultipleBINPrices(itemNames) {
        const results = new Map();
        
        // Process items with rate limiting
        for (const itemName of itemNames) {
            try {
                const price = await this.getLowestBIN(itemName);
                results.set(itemName, price);
            } catch (error) {
                console.error(`Failed to get price for ${itemName}:`, error);
                results.set(itemName, 0);
            }
        }
        
        return results;
    }

    /**
     * Get cached value if still valid
     * @param {string} key - Cache key
     * @returns {number|null} Cached value or null if expired/missing
     * @private
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    /**
     * Set cached value with timestamp
     * @param {string} key - Cache key
     * @param {number} value - Value to cache
     * @private
     */
    setCached(key, value) {
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Coflnet API cache cleared');
    }

    /**
     * Get API status information
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            cacheSize: this.cache.size,
            lastError: this.lastError
        };
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.CoflnetAuctionAPI = CoflnetAuctionAPI;
    
    // Create global instance
    if (!window.globalCoflnetAPI) {
        window.globalCoflnetAPI = new CoflnetAuctionAPI();
    }
}