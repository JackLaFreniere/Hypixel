/**
 * Global Hypixel Bazaar API Manager
 * 
 * This class provides a centralized way to interact with the Hypixel Bazaar API
 * across all calculators. It handles proxy management, caching, rate limiting,
 * and item database integration.
 * 
 * Usage:
 * const bazaarAPI = new HypixelBazaarAPI();
 * await bazaarAPI.initialize();
 * const price = await bazaarAPI.getItemPrice('SKELETON_KEY');
 * const priceByName = await bazaarAPI.getItemPriceByName('Skeleton Key');
 */
class HypixelBazaarAPI {
    constructor() {
        // CORS proxy servers for Hypixel API access
        // Reorder based on protocol for better compatibility
        this.isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
        
        if (this.isFileProtocol) {
            // File protocol works better with allorigins
            this.proxies = [
                'https://api.allorigins.win/get?url=',
                'https://corsproxy.io/?',
                'https://cors-anywhere.herokuapp.com/'
            ];
        } else {
            // HTTP/HTTPS works better with corsproxy
            this.proxies = [
                'https://corsproxy.io/?',
                'https://api.allorigins.win/get?url=',
                'https://cors-anywhere.herokuapp.com/'
            ];
        }
        
        this.currentProxyIndex = 0;
        this.hypixelAPI = 'https://api.hypixel.net/skyblock/bazaar';
        
        // Caching system - adjust cache time based on protocol
        this.cache = new Map();
        this.lastFetch = 0;
        this.rateLimitDelay = 500; // 500ms between requests (120 per minute)
        
        // File protocol needs longer cache to avoid CORS issues
        this.cacheExpiry = this.isFileProtocol ? 300000 : 60000; // 5 minutes for file://, 1 minute for HTTP
        
        // Items database for name-to-ID conversion
        this.itemsDatabase = null;
        this.itemsDatabaseLoaded = false;
        
        // Status tracking
        this.isInitialized = false;
        this.connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'error'
        this.lastError = null;
        
        // Event system for status updates
        this.eventListeners = new Map();
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
            this.setStatus('connecting', 'Loading items database...');
            await this.loadItemsDatabase();
            this.setStatus('connected', 'Bazaar API ready');
            this.isInitialized = true;
            return true;
        } catch (error) {
            this.setStatus('error', 'Failed to initialize Bazaar API');
            this.lastError = error;
            console.error('Failed to initialize Bazaar API:', error);
            return false;
        }
    }

    /**
     * Load the items database for name-to-ID conversion
     * @private
     */
    async loadItemsDatabase() {
        if (this.itemsDatabaseLoaded) {
            return;
        }

        try {
            console.log('Loading items database...');
            const response = await fetch('../items.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.itemsDatabase = data.items || data; // Handle both formats
            this.itemsDatabaseLoaded = true;
            console.log('Items database loaded:', this.itemsDatabase.length, 'items');
        } catch (error) {
            console.error('Failed to load items database:', error);
            this.itemsDatabase = [];
            this.itemsDatabaseLoaded = true; // Set to true to prevent retry loops
            throw error;
        }
    }

    /**
     * Fetch all bazaar data from the Hypixel API
     * @returns {Promise<Object>} Bazaar products data
     * @private
     */
    async fetchBazaarData() {
        const now = Date.now();
        
        // Check if we have cached data that's still valid
        if (this.cache.has('bazaarData') && (now - this.lastFetch) < this.cacheExpiry) {
            console.log('Using cached bazaar data');
            return this.cache.get('bazaarData');
        }

        // Rate limiting
        if ((now - this.lastFetch) < this.rateLimitDelay) {
            await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - (now - this.lastFetch)));
        }

        this.setStatus('connecting', 'Fetching bazaar data...');
        console.log('Environment info:', {
            protocol: window.location.protocol,
            host: window.location.host,
            origin: window.location.origin,
            userAgent: navigator.userAgent.substring(0, 50) + '...'
        });

        // Try different proxies
        for (let i = 0; i < this.proxies.length; i++) {
            const proxyIndex = (this.currentProxyIndex + i) % this.proxies.length;
            const proxy = this.proxies[proxyIndex];
            
            try {
                let proxyURL;
                let response;
                
                console.log(`Trying proxy ${i + 1}/${this.proxies.length}: ${proxy}`);
                
                if (proxy.includes('allorigins')) {
                    proxyURL = `${proxy}${encodeURIComponent(this.hypixelAPI)}`;
                    response = await fetch(proxyURL);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const proxyData = await response.json();
                    const hypixelData = JSON.parse(proxyData.contents);
                    
                    if (!hypixelData.success) {
                        throw new Error('Hypixel API returned error');
                    }

                    this.cache.set('bazaarData', hypixelData.products);
                    this.lastFetch = Date.now();
                    this.currentProxyIndex = proxyIndex; // Remember working proxy
                    this.setStatus('connected', 'Bazaar data loaded');
                    
                    console.log('Successfully fetched data via allorigins, items found:', Object.keys(hypixelData.products).length);
                    
                    return hypixelData.products;
                } else {
                    proxyURL = `${proxy}${encodeURIComponent(this.hypixelAPI)}`;
                    response = await fetch(proxyURL);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const hypixelData = await response.json();
                    console.log('API Response received:', !!hypixelData);
                    
                    if (!hypixelData.success) {
                        throw new Error('Hypixel API returned error');
                    }

                    this.cache.set('bazaarData', hypixelData.products);
                    this.lastFetch = Date.now();
                    this.currentProxyIndex = proxyIndex; // Remember working proxy
                    this.setStatus('connected', 'Bazaar data loaded');
                    
                    console.log('Successfully fetched data via other proxy, items found:', Object.keys(hypixelData.products).length);
                    
                    return hypixelData.products;
                }
            } catch (error) {
                console.warn(`Proxy ${proxy} failed:`, error.message);
                if (i === this.proxies.length - 1) {
                    this.setStatus('error', 'All proxies failed');
                    throw new Error('All proxies failed');
                }
            }
        }
    }

    /**
     * Get the price of an item by its API ID
     * @param {string} itemId - The Hypixel API item ID
     * @returns {Promise<number>} Item price in coins (0 if not found)
     */
    async getItemPrice(itemId) {
        try {
            const products = await this.fetchBazaarData();
            const product = products[itemId];
            
            if (!product) {
                console.warn(`Item ${itemId} not found in bazaar data`);
                return 0;
            }

            // Use buy_summary for sell offers (what players are buying for)
            if (product.buy_summary && product.buy_summary.length > 0) {
                const price = product.buy_summary[0].pricePerUnit;
                console.log(`${itemId}: ${price} coins (buy orders)`);
                return price;
            }
            
            // Fallback to sell_summary for buy offers (what players are selling for)
            if (product.sell_summary && product.sell_summary.length > 0) {
                const price = product.sell_summary[0].pricePerUnit;
                console.log(`${itemId}: ${price} coins (sell orders)`);
                return price;
            }
            
            console.warn(`${itemId}: No buy or sell orders available`);
            return 0;
        } catch (error) {
            console.error(`Error getting price for ${itemId}:`, error);
            this.setStatus('error', 'Failed to fetch item price');
            this.lastError = error;
            return 0;
        }
    }

    /**
     * Get the price of an item by its display name
     * @param {string} itemName - The display name of the item
     * @returns {Promise<number>} Item price in coins (0 if not found)
     */
    async getItemPriceByName(itemName) {
        const itemId = this.findItemId(itemName);
        return await this.getItemPrice(itemId);
    }

    /**
     * Get prices for multiple items at once
     * @param {Array<string>} itemIds - Array of Hypixel API item IDs
     * @returns {Promise<Map<string, number>>} Map of item IDs to prices
     */
    async getMultiplePrices(itemIds) {
        const prices = new Map();
        const products = await this.fetchBazaarData();
        
        for (const itemId of itemIds) {
            const product = products[itemId];
            
            if (!product) {
                console.warn(`Item ${itemId} not found in bazaar data`);
                prices.set(itemId, 0);
                continue;
            }

            // Use buy_summary for sell offers (what players are buying for)
            if (product.buy_summary && product.buy_summary.length > 0) {
                prices.set(itemId, product.buy_summary[0].pricePerUnit);
            } else if (product.sell_summary && product.sell_summary.length > 0) {
                // Fallback to sell_summary for buy offers (what players are selling for)
                prices.set(itemId, product.sell_summary[0].pricePerUnit);
            } else {
                prices.set(itemId, 0);
            }
        }
        
        return prices;
    }

    /**
     * Get prices for multiple items by their display names with retry logic
     * @param {Array<string>} itemNames - Array of display names
     * @returns {Promise<Map<string, number>>} Map of item names to prices
     */
    async getMultiplePricesByName(itemNames) {
        const maxRetries = 2;
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const nameToIdMap = new Map();
                const itemIds = [];
                
                // Convert names to IDs
                for (const name of itemNames) {
                    const id = this.findItemId(name);
                    nameToIdMap.set(id, name);
                    itemIds.push(id);
                }
                
                // Get prices by ID
                const pricesById = await this.getMultiplePrices(itemIds);
                
                // Convert back to names
                const pricesByName = new Map();
                for (const [id, price] of pricesById) {
                    const name = nameToIdMap.get(id);
                    if (name) {
                        pricesByName.set(name, price);
                    }
                }
                
                return pricesByName;
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Clear cache and wait before retry
                    this.clearCache();
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
        
        console.error('All retry attempts failed:', lastError);
        throw lastError || new Error('Max retries exceeded');
    }

    /**
     * Find the API ID for an item by its display name
     * @param {string} itemName - The display name of the item
     * @returns {string} The API ID for the item
     */
    findItemId(itemName) {
        if (!this.itemsDatabase || this.itemsDatabase.length === 0) {
            console.warn('Items database not loaded, using fallback ID generation');
            return this.nameToApiKey(itemName);
        }

        const item = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (item && item.id) {
            console.log(`Found item: ${itemName} -> ${item.id}`);
            return item.id;
        } else {
            console.warn(`Item not found in database: ${itemName}, using fallback`);
            return this.nameToApiKey(itemName);
        }
    }

    /**
     * Convert display name to API key format (public method)
     * @param {string} itemName - The display name
     * @returns {string} The generated API key
     */
    nameToApiKey(itemName) {
        return itemName
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[()]/g, '');
    }

    /**
     * Clear the cache and force fresh data on next request
     */
    clearCache() {
        this.cache.clear();
        this.lastFetch = 0;
        console.log('Bazaar API cache cleared');
    }

    /**
     * Get information about an item from the database
     * @param {string} itemName - The display name of the item
     * @returns {Object|null} Item information or null if not found
     */
    getItemInfo(itemName) {
        if (!this.itemsDatabase || this.itemsDatabase.length === 0) {
            return null;
        }

        return this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        ) || null;
    }

    /**
     * Search for items by partial name match
     * @param {string} searchTerm - Partial name to search for
     * @param {number} limit - Maximum number of results (default: 10)
     * @returns {Array<Object>} Array of matching items
     */
    searchItems(searchTerm, limit = 10) {
        if (!this.itemsDatabase || this.itemsDatabase.length === 0) {
            return [];
        }

        const searchLower = searchTerm.toLowerCase();
        return this.itemsDatabase
            .filter(item => item.name && item.name.toLowerCase().includes(searchLower))
            .slice(0, limit);
    }

    /**
     * Set the connection status and notify listeners
     * @param {string} status - Status: 'disconnected', 'connecting', 'connected', 'error'
     * @param {string} message - Status message
     * @private
     */
    setStatus(status, message) {
        this.connectionStatus = status;
        this.emit('statusChange', { status, message });
        console.log(`Bazaar API Status: ${status} - ${message}`);
    }

    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @private
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    /**
     * Get the current status of the API
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            connectionStatus: this.connectionStatus,
            lastError: this.lastError,
            cacheSize: this.cache.size,
            itemsDatabaseLoaded: this.itemsDatabaseLoaded,
            itemsCount: this.itemsDatabase ? this.itemsDatabase.length : 0
        };
    }

    /**
     * Refresh all cached data
     * @returns {Promise<boolean>} Success status
     */
    async refresh() {
        try {
            this.clearCache();
            this.setStatus('connecting', 'Refreshing bazaar data...');
            await this.fetchBazaarData();
            this.setStatus('connected', 'Data refreshed successfully');
            return true;
        } catch (error) {
            this.setStatus('error', 'Failed to refresh data');
            this.lastError = error;
            console.error('Failed to refresh bazaar data:', error);
            return false;
        }
    }
}

// Create global instance
window.HypixelBazaarAPI = window.HypixelBazaarAPI || HypixelBazaarAPI;

// Auto-initialize if this is the first time loading
if (!window.globalBazaarAPI) {
    console.log('Initializing global Bazaar API...');
    window.globalBazaarAPI = new HypixelBazaarAPI();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.globalBazaarAPI.initialize();
        });
    } else {
        window.globalBazaarAPI.initialize();
    }
}