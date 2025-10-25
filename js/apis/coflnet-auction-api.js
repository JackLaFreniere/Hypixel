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
        this.cacheExpiry = 600000; // 10 minutes (increased to reduce API calls)
        this.rateLimitDelay = 250; // 250ms between requests to be respectful
        this.lastRequest = 0;
        this.localStoragePrefix = 'coflnet_auction_';
        
        // Items database for name-to-tag conversion
        this.itemsDatabase = null;
        this.itemsDatabaseLoaded = false;
        
        // Status tracking
        this.isInitialized = false;
        this.connectionStatus = 'disconnected';
        this.lastError = null;
        
        // Load persistent cache on initialization
        this.loadPersistentCache();
    }

    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            await this.loadItemsDatabase();
            this.isInitialized = true;
            return true;
        } catch (error) {
            this.lastError = error;
            return false;
        }
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

    async getLowestBIN(itemName) {
        try {
            const itemTag = itemName.includes('_') ? itemName : this.findItemTag(itemName);
            const cacheKey = `bin_${itemTag}`;
            
            // Check cache first
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                return cached;
            }
            
            await this.rateLimit();
            
            const url = `${this.baseURL}/auctions/tag/${itemTag}/active/bin`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Try alternative endpoint
                    const altUrl = `${this.baseURL}/item/${itemTag}/price`;
                    const altResponse = await fetch(altUrl);
                    
                    if (altResponse.ok) {
                        const altData = await altResponse.json();
                        const price = altData.median || altData.mean || 0;
                        this.setCached(cacheKey, price);
                        return price;
                    }
                    
                    this.setCached(cacheKey, 0);
                    return 0;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            const lowestPrice = data[0].startingBid || data[0].highestBidAmount || 0;
            this.setCached(cacheKey, lowestPrice);
            
            return lowestPrice;
            
        } catch (error) {
            return 0;
        }
    }

    async getAverageBIN(itemName) {
        try {
            const itemTag = itemName.includes('_') ? itemName : this.findItemTag(itemName);
            const cacheKey = `avg_bin_${itemTag}`;
            
            // Check cache first
            const cached = this.getCached(cacheKey);
            if (cached !== null) {
                return cached;
            }
            
            await this.rateLimit();
            
            const url = `${this.baseURL}/auctions/tag/${itemTag}/active/bin`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.setCached(cacheKey, 0);
                    return 0;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            // Calculate average
            const prices = data.map(auction => auction.startingBid || auction.highestBidAmount || 0);
            const validPrices = prices.filter(price => price > 0);
            
            if (validPrices.length === 0) {
                this.setCached(cacheKey, 0);
                return 0;
            }
            
            const averagePrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
            this.setCached(cacheKey, Math.round(averagePrice));
            
            return Math.round(averagePrice);
            
        } catch (error) {
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
                results.set(itemName, 0);
            }
        }
        
        return results;
    }

    /**
     * Get cached value if still valid (checks both memory and localStorage)
     * @param {string} key - Cache key
     * @returns {number|null} Cached value or null if expired/missing
     * @private
     */
    getCached(key) {
        // Check memory cache first
        const cached = this.cache.get(key);
        if (cached) {
            const now = Date.now();
            if (now - cached.timestamp <= this.cacheExpiry) {
                return cached.value;
            }
            this.cache.delete(key);
        }
        
        // Check localStorage
        try {
            const storageKey = this.localStoragePrefix + key;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                const now = Date.now();
                if (now - parsed.timestamp <= this.cacheExpiry) {
                    // Restore to memory cache
                    this.cache.set(key, parsed);
                    return parsed.value;
                } else {
                    // Expired, remove it
                    localStorage.removeItem(storageKey);
                }
            }
        } catch (error) {
            // Silent fail
        }
        
        return null;
    }

    /**
     * Set cached value with timestamp (saves to both memory and localStorage)
     * @param {string} key - Cache key
     * @param {number} value - Value to cache
     * @private
     */
    setCached(key, value) {
        const cacheObject = {
            value: value,
            timestamp: Date.now()
        };
        
        // Save to memory cache
        this.cache.set(key, cacheObject);
        
        // Save to localStorage
        try {
            const storageKey = this.localStoragePrefix + key;
            localStorage.setItem(storageKey, JSON.stringify(cacheObject));
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Load all persistent cache entries from localStorage into memory
     * @private
     */
    loadPersistentCache() {
        try {
            const now = Date.now();
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const storageKey = localStorage.key(i);
                if (storageKey && storageKey.startsWith(this.localStoragePrefix)) {
                    try {
                        const stored = localStorage.getItem(storageKey);
                        const parsed = JSON.parse(stored);
                        
                        // Check if still valid
                        if (now - parsed.timestamp <= this.cacheExpiry) {
                            const cacheKey = storageKey.substring(this.localStoragePrefix.length);
                            this.cache.set(cacheKey, parsed);
                        } else {
                            keysToRemove.push(storageKey);
                        }
                    } catch (error) {
                        keysToRemove.push(storageKey);
                    }
                }
            }
            
            // Clean up expired entries
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            if (this.cache.size > 0) {
                console.log(`✓ Loaded ${this.cache.size} cached auction prices from localStorage`);
            }
        } catch (error) {
            // Silent fail
        }
    }

    clearCache() {
        this.cache.clear();
        
        // Clear localStorage entries
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.localStoragePrefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            // Silent fail
        }
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