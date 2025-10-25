/**
 * Hypixel Bazaar API
 */
class HypixelBazaarAPI {
    constructor() {
        this.hypixelAPI = 'https://api.hypixel.net/skyblock/bazaar';
        this.cache = new Map();
        this.lastFetch = 0;
        this.cacheExpiry = 300000; // 5 minutes cache (increased to reduce API calls)
        this.localStorageKey = 'hypixel_bazaar_cache';
    }

    async fetchBazaarData() {
        const now = Date.now();
        
        // Check memory cache first
        if (this.cache.has('bazaarData') && (now - this.lastFetch) < this.cacheExpiry) {
            return this.cache.get('bazaarData');
        }
        
        // Check localStorage for persistent cache
        const persistentCache = this.getFromLocalStorage();
        if (persistentCache && (now - persistentCache.timestamp) < this.cacheExpiry) {
            console.log('✓ Using cached bazaar data from localStorage');
            this.cache.set('bazaarData', persistentCache.data);
            this.lastFetch = persistentCache.timestamp;
            return persistentCache.data;
        }
        
        const proxies = [
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        let lastError = null;
        
        for (const proxy of proxies) {
            try {
                const fullUrl = `${proxy}${encodeURIComponent(this.hypixelAPI)}`;
                
                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Handle different proxy response formats
                let hypixelData;
                
                if (proxy.includes('codetabs') || proxy.includes('thingproxy')) {
                    hypixelData = data;
                } else if (proxy.includes('allorigins')) {
                    if (data.contents) {
                        hypixelData = JSON.parse(data.contents);
                    } else {
                        throw new Error('No contents in allorigins response');
                    }
                } else {
                    hypixelData = data;
                }
                
                if (!hypixelData.success) {
                    throw new Error(`Hypixel API returned success: false`);
                }
                
                if (!hypixelData.products) {
                    throw new Error('No products in Hypixel response');
                }
                
                // Cache the result in memory and localStorage
                this.cache.set('bazaarData', hypixelData.products);
                this.lastFetch = now;
                this.saveToLocalStorage(hypixelData.products, now);
                
                return hypixelData.products;
                
            } catch (error) {
                lastError = error;
            }
        }
        
        // Fallback: try a direct request
        try {
            const response = await fetch(this.hypixelAPI, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.products) {
                    this.cache.set('bazaarData', data.products);
                    this.lastFetch = now;
                    this.saveToLocalStorage(data.products, now);
                    return data.products;
                }
            }
        } catch (directError) {
            // Ignore
        }
        
        throw new Error(`All bazaar API methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    async getItemPrice(itemId) {
        try {
            const products = await this.fetchBazaarData();
            const product = products[itemId];
            
            if (!product) {
                return 0;
            }
            
            // Try buy orders first
            if (product.buy_summary && product.buy_summary.length > 0) {
                return product.buy_summary[0].pricePerUnit;
            }
            
            // Fallback to sell orders
            if (product.sell_summary && product.sell_summary.length > 0) {
                return product.sell_summary[0].pricePerUnit;
            }
            
            return 0;
            
        } catch (error) {
            return 0;
        }
    }

    nameToApiKey(itemName) {
        return itemName
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[()]/g, '');
    }

    async getItemPriceByName(itemName) {
        const itemId = this.findItemId(itemName);
        return await this.getItemPrice(itemId);
    }

    async initialize() {
        try {
            await this.loadItemsDatabase();
            return true;
        } catch (error) {
            return false;
        }
    }

    async loadItemsDatabase() {
        if (this.itemsDatabaseLoaded) {
            return;
        }

        try {
            const possiblePaths = [
                '../jsons/items.json',
                './jsons/items.json',
                '/jsons/items.json',
                'jsons/items.json'
            ];
            
            let response;
            
            for (const path of possiblePaths) {
                try {
                    response = await fetch(path);
                    if (response.ok) {
                        break;
                    }
                } catch (e) {
                    // Try next path
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(`Failed to load items.json`);
            }
            
            const data = await response.json();
            this.itemsDatabase = data.items || data;
            this.itemsDatabaseLoaded = true;
            
        } catch (error) {
            this.itemsDatabase = [];
            this.itemsDatabaseLoaded = true;
            throw error;
        }
    }

    findItemId(itemName) {
        if (!this.itemsDatabase || this.itemsDatabase.length === 0) {
            return this.nameToApiKey(itemName);
        }
        
        // Exact match
        const item = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (item && item.id) {
            return item.id;
        }
        
        // Partial match fallback
        const partialMatch = this.itemsDatabase.find(item => 
            item.name && item.name.toLowerCase().includes(itemName.toLowerCase())
        );
        
        if (partialMatch && partialMatch.id) {
            return partialMatch.id;
        }
        
        return this.nameToApiKey(itemName);
    }

    clearCache() {
        this.cache.clear();
        this.lastFetch = 0;
        localStorage.removeItem(this.localStorageKey);
    }

    /**
     * Save bazaar data to localStorage for persistence between page loads
     * @private
     */
    saveToLocalStorage(data, timestamp) {
        try {
            const cacheObject = {
                data: data,
                timestamp: timestamp
            };
            localStorage.setItem(this.localStorageKey, JSON.stringify(cacheObject));
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Retrieve bazaar data from localStorage
     * @private
     * @returns {Object|null} Cached data with timestamp, or null if not found/invalid
     */
    getFromLocalStorage() {
        try {
            const cached = localStorage.getItem(this.localStorageKey);
            if (!cached) return null;
            
            const parsed = JSON.parse(cached);
            if (!parsed.data || !parsed.timestamp) return null;
            
            return parsed;
        } catch (error) {
            return null;
        }
    }
}

// Make globally available
window.HypixelBazaarAPI = HypixelBazaarAPI;

if (!window.globalBazaarAPI) {
    window.globalBazaarAPI = new HypixelBazaarAPI();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await window.globalBazaarAPI.initialize();
        });
    } else {
        window.globalBazaarAPI.initialize();
    }
}