/**
 * Step-by-Step Bazaar API Rebuild
 * Starting with minimal functionality and building up
 */
class HypixelBazaarAPI {
    constructor() {
        console.log('[BAZAAR] Step 1: Constructor called');
        
        // Step 1: Basic setup
        this.hypixelAPI = 'https://api.hypixel.net/skyblock/bazaar';
        this.cache = new Map();
        this.lastFetch = 0;
        this.cacheExpiry = 60000; // 1 minute cache
        
        console.log('[BAZAAR] Step 1: Constructor complete');
    }

    /**
     * Step 2: Simple proxy test - try one proxy at a time with timeout
     */
    async testSingleProxy(proxyUrl, timeout = 10000) {
        console.log(`[BAZAAR] Step 2: Testing proxy: ${proxyUrl}`);
        
        return new Promise(async (resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout after ${timeout}ms`));
            }, timeout);
            
            try {
                const fullUrl = `${proxyUrl}${encodeURIComponent(this.hypixelAPI)}`;
                console.log(`[BAZAAR] Step 2: Full URL: ${fullUrl}`);
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                console.log(`[BAZAAR] Step 2: Response status: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log(`[BAZAAR] Step 2: Response data type:`, typeof data);
                console.log(`[BAZAAR] Step 2: Response keys:`, Object.keys(data));
                
                clearTimeout(timeoutId);
                resolve(data);
                
            } catch (error) {
                clearTimeout(timeoutId);
                console.error(`[BAZAAR] Step 2: Proxy ${proxyUrl} failed:`, error.message);
                reject(error);
            }
        });
    }

    /**
     * Step 3: Test multiple proxies in order
     */
    async fetchBazaarData() {
        console.log('[BAZAAR] Step 3: Starting fetchBazaarData');
        
        // Check cache first
        const now = Date.now();
        if (this.cache.has('bazaarData') && (now - this.lastFetch) < this.cacheExpiry) {
            console.log('[BAZAAR] Step 3: Using cached data');
            return this.cache.get('bazaarData');
        }
        
        // Updated list of working proxies (as of 2025)
        const proxies = [
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        let lastError = null;
        
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            console.log(`[BAZAAR] Step 3: Trying proxy ${i + 1}/${proxies.length}: ${proxy}`);
            
            try {
                const fullUrl = `${proxy}${encodeURIComponent(this.hypixelAPI)}`;
                console.log(`[BAZAAR] Step 3: Full URL: ${fullUrl}`);
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000
                });
                
                console.log(`[BAZAAR] Step 3: Response status: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log(`[BAZAAR] Step 3: Response data type:`, typeof data);
                console.log(`[BAZAAR] Step 3: Response keys:`, Object.keys(data));
                
                // Handle different proxy response formats
                let hypixelData;
                
                if (proxy.includes('codetabs') || proxy.includes('thingproxy')) {
                    // These return API data directly
                    console.log('[BAZAAR] Step 3: Processing direct proxy response');
                    hypixelData = data;
                } else if (proxy.includes('allorigins')) {
                    // allorigins returns {contents: "..."} 
                    console.log('[BAZAAR] Step 3: Processing allorigins response');
                    if (data.contents) {
                        hypixelData = JSON.parse(data.contents);
                    } else {
                        throw new Error('No contents in allorigins response');
                    }
                } else {
                    // Default: assume direct response
                    console.log('[BAZAAR] Step 3: Processing as direct response');
                    hypixelData = data;
                }
                
                console.log('[BAZAAR] Step 3: Hypixel data keys:', Object.keys(hypixelData));
                
                if (!hypixelData.success) {
                    throw new Error(`Hypixel API returned success: false - ${JSON.stringify(hypixelData)}`);
                }
                
                if (!hypixelData.products) {
                    throw new Error('No products in Hypixel response');
                }
                
                console.log(`[BAZAAR] Step 3: SUCCESS! Found ${Object.keys(hypixelData.products).length} products`);
                console.log(`[BAZAAR] Step 3: Sample products:`, Object.keys(hypixelData.products).slice(0, 5));
                
                // Cache the result
                this.cache.set('bazaarData', hypixelData.products);
                this.lastFetch = now;
                
                return hypixelData.products;
                
            } catch (error) {
                lastError = error;
                console.error(`[BAZAAR] Step 3: Proxy ${proxy} failed:`, error.message);
                
                // If it's the last proxy, we'll try a fallback
                if (i === proxies.length - 1) {
                    console.error('[BAZAAR] Step 3: All proxies failed, trying fallback...');
                    break;
                }
            }
        }
        
        // Fallback: try a direct request (might work in some environments)
        try {
            console.log('[BAZAAR] Step 3: Attempting direct API call as last resort...');
            const response = await fetch(this.hypixelAPI, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.products) {
                    console.log('[BAZAAR] Step 3: Direct API call succeeded!');
                    this.cache.set('bazaarData', data.products);
                    this.lastFetch = now;
                    return data.products;
                }
            }
        } catch (directError) {
            console.log('[BAZAAR] Step 3: Direct API call also failed:', directError.message);
        }
        
        console.error('[BAZAAR] Step 3: ALL METHODS FAILED');
        throw new Error(`All bazaar API methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Step 4: Basic price lookup by exact item ID
     */
    async getItemPrice(itemId) {
        console.log(`[BAZAAR] Step 4: Getting price for item ID: ${itemId}`);
        
        try {
            const products = await this.fetchBazaarData();
            const product = products[itemId];
            
            if (!product) {
                console.warn(`[BAZAAR] Step 4: Item ${itemId} not found in bazaar data`);
                console.log(`[BAZAAR] Step 4: Available items (first 10):`, Object.keys(products).slice(0, 10));
                return 0;
            }
            
            console.log(`[BAZAAR] Step 4: Found product for ${itemId}:`, {
                hasBuySummary: !!product.buy_summary,
                buySummaryLength: product.buy_summary ? product.buy_summary.length : 0,
                hasSellSummary: !!product.sell_summary,
                sellSummaryLength: product.sell_summary ? product.sell_summary.length : 0
            });
            
            // Try buy orders first (what players are willing to pay)
            if (product.buy_summary && product.buy_summary.length > 0) {
                const price = product.buy_summary[0].pricePerUnit;
                console.log(`[BAZAAR] Step 4: Buy price for ${itemId}: ${price} coins`);
                return price;
            }
            
            // Fallback to sell orders (what players are selling for)
            if (product.sell_summary && product.sell_summary.length > 0) {
                const price = product.sell_summary[0].pricePerUnit;
                console.log(`[BAZAAR] Step 4: Sell price for ${itemId}: ${price} coins`);
                return price;
            }
            
            console.warn(`[BAZAAR] Step 4: No price data for ${itemId}`);
            return 0;
            
        } catch (error) {
            console.error(`[BAZAAR] Step 4: Error getting price for ${itemId}:`, error);
            return 0;
        }
    }

    /**
     * Step 6: Convert item name to API ID format (simple fallback only)
     */
    nameToApiKey(itemName) {
        console.log(`[BAZAAR] Step 6: Converting "${itemName}" to API key (fallback method)`);
        
        // Simple conversion: just uppercase and replace spaces with underscores
        const apiKey = itemName
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[()]/g, '');
        
        console.log(`[BAZAAR] Step 6: Fallback conversion: "${itemName}" -> "${apiKey}"`);
        return apiKey;
    }

    /**
     * Step 7: Get price by item display name (what the calculator uses)
     */
    async getItemPriceByName(itemName) {
        console.log(`[BAZAAR] Step 7: Getting price for item name: "${itemName}"`);
        
        // Use database lookup to find the correct item ID
        const itemId = this.findItemId(itemName);
        console.log(`[BAZAAR] Step 7: Item ID resolved to: "${itemId}"`);
        
        return await this.getItemPrice(itemId);
    }

    /**
     * Step 8: Initialize method - load items database
     */
    async initialize() {
        console.log('[BAZAAR] Step 8: Initialize called');
        try {
            await this.loadItemsDatabase();
            console.log('[BAZAAR] Step 8: Initialize completed successfully');
            return true;
        } catch (error) {
            console.error('[BAZAAR] Step 8: Initialize failed:', error);
            // Don't throw - allow fallback to work
            return false;
        }
    }

    /**
     * Step 8b: Load items database from JSON file
     */
    async loadItemsDatabase() {
        if (this.itemsDatabaseLoaded) {
            console.log('[BAZAAR] Step 8b: Items database already loaded');
            return;
        }

        try {
            console.log('[BAZAAR] Step 8b: Loading items database...');
            console.log('[BAZAAR] Step 8b: Current location:', window.location.href);
            
            // Try different paths based on current location
            const possiblePaths = [
                '../jsons/items.json',        // From calculators/ folder
                './jsons/items.json',         // From root folder
                '/jsons/items.json',          // Absolute path
                'jsons/items.json'            // Relative from current
            ];
            
            let response;
            let successfulPath;
            
            for (const path of possiblePaths) {
                try {
                    console.log(`[BAZAAR] Step 8b: Trying path: ${path}`);
                    response = await fetch(path);
                    if (response.ok) {
                        successfulPath = path;
                        console.log(`[BAZAAR] Step 8b: Successfully accessed: ${path}`);
                        break;
                    } else {
                        console.log(`[BAZAAR] Step 8b: Path ${path} returned ${response.status}`);
                    }
                } catch (e) {
                    console.log(`[BAZAAR] Step 8b: Path ${path} failed:`, e.message);
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(`Failed to load items.json from any path. Last status: ${response?.status}`);
            }
            
            const data = await response.json();
            console.log(`[BAZAAR] Step 8b: Response data structure:`, Object.keys(data));
            
            this.itemsDatabase = data.items || data; // Handle both formats
            this.itemsDatabaseLoaded = true;
            console.log(`[BAZAAR] Step 8b: Items database loaded: ${this.itemsDatabase.length} items from ${successfulPath}`);
            
            // Log some sample items to verify structure
            console.log(`[BAZAAR] Step 8b: Sample items:`, this.itemsDatabase.slice(0, 3).map(item => ({
                name: item.name,
                id: item.id
            })));
            
        } catch (error) {
            console.error('[BAZAAR] Step 8b: Failed to load items database:', error);
            this.itemsDatabase = [];
            this.itemsDatabaseLoaded = true; // Set to true to prevent retry loops
            throw error;
        }
    }

    /**
     * Step 8c: Find item ID using the loaded database
     */
    findItemId(itemName) {
        console.log(`[BAZAAR] Step 8c: Looking for item: "${itemName}"`);
        
        if (!this.itemsDatabase || this.itemsDatabase.length === 0) {
            console.warn('[BAZAAR] Step 8c: Items database not loaded, using fallback');
            const fallbackId = this.nameToApiKey(itemName);
            console.log(`[BAZAAR] Step 8c: Fallback ID: "${fallbackId}"`);
            return fallbackId;
        }

        console.log(`[BAZAAR] Step 8c: Searching in database of ${this.itemsDatabase.length} items`);
        
        // Search for exact name match (case insensitive)
        const item = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (item && item.id) {
            console.log(`[BAZAAR] Step 8c: Found exact match: "${itemName}" -> "${item.id}"`);
            return item.id;
        } else {
            console.warn(`[BAZAAR] Step 8c: No exact match found for "${itemName}"`);
            
            // Try partial matching as fallback
            const partialMatch = this.itemsDatabase.find(item => 
                item.name && item.name.toLowerCase().includes(itemName.toLowerCase())
            );
            
            if (partialMatch && partialMatch.id) {
                console.log(`[BAZAAR] Step 8c: Found partial match: "${itemName}" -> "${partialMatch.name}" -> "${partialMatch.id}"`);
                return partialMatch.id;
            }
            
            console.warn(`[BAZAAR] Step 8c: No match found, using fallback conversion`);
            const fallbackId = this.nameToApiKey(itemName);
            console.log(`[BAZAAR] Step 8c: Fallback ID: "${fallbackId}"`);
            return fallbackId;
        }
    }

    /**
     * Step 9: Clear cache method
     */
    clearCache() {
        console.log('[BAZAAR] Step 9: Clearing cache');
        this.cache.clear();
        this.lastFetch = 0;
    }


}

// Step 5: Create global instance for testing
console.log('[BAZAAR] Step 5: Creating global instance');
window.HypixelBazaarAPI = HypixelBazaarAPI;

if (!window.globalBazaarAPI) {
    window.globalBazaarAPI = new HypixelBazaarAPI();
    console.log('[BAZAAR] Step 5: Global instance created');
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('[BAZAAR] Step 5: DOM ready, initializing...');
            await window.globalBazaarAPI.initialize();
        });
    } else {
        console.log('[BAZAAR] Step 5: DOM already ready, initializing...');
        window.globalBazaarAPI.initialize();
    }
}