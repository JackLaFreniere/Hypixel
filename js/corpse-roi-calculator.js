class CorpseROICalculator {
    constructor() {
        console.log('CorpseROICalculator constructor called');
        try {
            this.bazaarAPI = window.globalBazaarAPI || new HypixelBazaarAPI();
            this.coflnetAPI = window.globalCoflnetAPI || new CoflnetAuctionAPI();
            console.log('APIs assigned successfully');
        } catch (error) {
            console.error('Error assigning APIs:', error);
        }
        
        this.currentCorpse = null;
        this.keyPrice = 0;
        this.dropTables = {};
        this.keyNames = {
            vanguard: "Skeleton Key",
            tungsten: "Tungsten Key", 
            umber: "Umber Key",
            lapis: "Free" // Lapis corpse is free
        };
        this.corpseMaxWeights = {
            vanguard: 2399,
            tungsten: 12195,
            umber: 12195,
            lapis: 24890
        };
        this.corpseRolls = {
            vanguard: 6.7,
            tungsten: 5.7,
            umber: 5.7,
            lapis: 4.7
        };
        this.itemPrices = {};
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.isLoaded = false;
        
        // Initialize gemstone pricing reference
        this.gemstonePricing = null;
        
        console.log('CorpseROICalculator constructor completed');
    }

    /**
     * Set the gemstone pricing utility reference
     */
    setGemstonePricing(gemstonePricing) {
        this.gemstonePricing = gemstonePricing;
        console.log('Gemstone pricing utility set for corpse calculator');
    }

    /**
     * Get crystal price for a specific gemstone type
     */
    async getCrystalPrice(gemstoneType) {
        if (!this.gemstonePricing) {
            console.warn('Gemstone pricing utility not available');
            return 0;
        }
        
        try {
            return await this.gemstonePricing.getGemstonePrice(gemstoneType, 'crystal');
        } catch (error) {
            console.error(`Error fetching crystal price for ${gemstoneType}:`, error);
            return 0;
        }
    }

    /**
     * Get all crystal prices
     */
    async getAllCrystalPrices() {
        if (!this.gemstonePricing) {
            console.warn('Gemstone pricing utility not available');
            return {};
        }
        
        try {
            const allPrices = await this.gemstonePricing.getAllGemstonePrices();
            const crystalPrices = {};
            
            for (const [gemstone, prices] of Object.entries(allPrices)) {
                crystalPrices[gemstone] = prices.crystal || 0;
            }
            
            return crystalPrices;
        } catch (error) {
            console.error('Error fetching all crystal prices:', error);
            return {};
        }
    }

    /**
     * Check if an item name represents a crystal
     */
    isCrystalItem(itemName) {
        // Crystal items typically end with "Crystal"
        return itemName.toLowerCase().includes('crystal');
    }

    /**
     * Extract gemstone type from crystal item name and get its price
     */
    async getCrystalPriceForItem(itemName) {
        if (!this.gemstonePricing) {
            console.warn('Gemstone pricing utility not available');
            return 0;
        }
        
        // Extract gemstone type from crystal name
        // Examples: "Amber Crystal" -> "amber", "Jasper Crystal" -> "jasper"
        const gemstoneType = itemName.toLowerCase()
            .replace(' crystal', '')
            .replace('crystal', '')
            .trim();
        
        console.log(`Extracted gemstone type "${gemstoneType}" from "${itemName}"`);
        
        try {
            return await this.getCrystalPrice(gemstoneType);
        } catch (error) {
            console.error(`Error getting crystal price for ${itemName}:`, error);
            return 0;
        }
    }

    /**
     * Format numbers for display
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return Math.round(num).toLocaleString();
    }

    async loadLootTables() {
        try {
            const response = await fetch('../jsons/corpse-loot-tables.json');
            const data = await response.json();
            this.dropTables = data.corpseDropTables;
            if (data.keyNames) {
                this.keyNames = data.keyNames;
            }
            this.isLoaded = true;
            console.log('Loot tables loaded successfully');
        } catch (error) {
            console.error('Error loading loot tables:', error);
            // Fallback to basic tables if JSON fails to load
            this.dropTables = {
                vanguard: [
                    { name: "Skeleton Key", quantity: 1, weight: 6, source: "bazaar" },
                    { name: "Umber Key", quantity: 4, weight: 10, source: "bazaar" }
                ],
                tungsten: [
                    { name: "Tungsten Key", quantity: 1, weight: 10, source: "bazaar" }
                ],
                umber: [
                    { name: "Umber Key", quantity: 1, weight: 10, source: "bazaar" }
                ],
                lapis: [
                    { name: "Lapis Key", quantity: 1, weight: 10, source: "bazaar" }
                ]
            };
            this.isLoaded = true;
        }
    }

    async setCorpseType(corpseType) {
        console.log('setCorpseType called with:', corpseType);
        
        // Show loading immediately when transitioning to new corpse
        this.showLoading(true);
        this.showStatus(`Loading ${corpseType.charAt(0).toUpperCase() + corpseType.slice(1)} Corpse data...`, 'success');
        
        // Wait for loot tables to load if not already loaded
        if (!this.isLoaded) {
            console.log('Loading loot tables...');
            await this.loadLootTables();
        }
        
        this.currentCorpse = corpseType;
        const keyName = this.keyNames[corpseType];
        console.log('Key name for corpse:', keyName);
        
        // Update UI
        document.getElementById('dropTableTitle').textContent = `Drop Table - ${corpseType.charAt(0).toUpperCase() + corpseType.slice(1)} Corpse`;
        
        // Auto-fetch key price
        console.log('Auto-setting key price...');
        await this.autoSetKeyPrice(corpseType);
        
        // Auto-update all item prices
        console.log('Auto-updating item prices...');
        await this.updatePrices();
        
        // Show final status
        this.showStatus(`${corpseType.charAt(0).toUpperCase() + corpseType.slice(1)} Corpse loaded successfully!`, 'success');
    }

    async autoSetKeyPrice(corpseType) {
        console.log('autoSetKeyPrice called with:', corpseType);
        
        if (corpseType === 'lapis') {
            // Lapis corpse is free
            console.log('Setting lapis corpse to free');
            this.keyPrice = 0;
            this.showStatus('Lapis corpse is free to open!', 'success');
        } else {
            try {
                const keyName = this.keyNames[corpseType];
                console.log('Fetching price for key:', keyName);
                this.showStatus(`Fetching ${keyName} price...`, 'success');
                
                // Wait a moment to ensure APIs are ready
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const price = await this.bazaarAPI.getItemPriceByName(keyName);
                console.log('Fetched price:', price);
                this.keyPrice = price;
                
                this.showStatus(`${keyName} price: ${this.formatPrice(price)}`, 'success');
            } catch (error) {
                console.error(`Error fetching key price for ${corpseType}:`, error);
                this.showStatus(`Could not fetch key price. Using default value.`, 'warning');
                this.keyPrice = 0;
            }
        }
    }

    setKeyPrice(price) {
        this.keyPrice = price;
        // Automatically recalculate ROI when key price changes
        if (this.currentCorpse) {
            this.calculateROI();
        }
    }

    async updatePrices() {
        if (!this.currentCorpse) {
            this.showStatus('Please select a corpse type first', 'warning');
            return;
        }

        this.showLoading(true);
        const dropItems = this.dropTables[this.currentCorpse];
        
        try {
            this.showStatus('Fetching latest prices...', 'success');
            
            // Get all unique items
            const uniqueItems = [...new Set(dropItems.map(item => item.name))];
            
            // Fetch prices for all items
            for (const itemName of uniqueItems) {
                try {
                    const item = dropItems.find(d => d.name === itemName);
                    let price = 0;
                    
                    // Check if this is a crystal item first
                    if (this.isCrystalItem(itemName)) {
                        price = await this.getCrystalPriceForItem(itemName);
                        console.log(`Crystal price for ${itemName}: ${price}`);
                    } else if (item.source === 'bazaar') {
                        price = await this.bazaarAPI.getItemPriceByName(itemName);
                    } else if (item.source === 'auction') {
                        // Try Coflnet first, then fallback
                        try {
                            console.log(`=== AUCTION ITEM DEBUG: ${itemName} ===`);
                            
                            // Try multiple variations of the name
                            const variations = [
                                itemName,
                                itemName.replace('Locket', 'Pendant'),
                                'SHATTERED_PENDANT',
                                'Shattered Pendant'
                            ];
                            
                            for (const variation of variations) {
                                console.log(`Trying variation: "${variation}"`);
                                const testPrice = await this.coflnetAPI.getLowestBIN(variation);
                                if (testPrice > 0) {
                                    console.log(`SUCCESS: ${variation} returned ${testPrice}`);
                                    price = testPrice;
                                    break;
                                }
                            }
                            
                            if (price === 0) {
                                console.warn(`All variations failed for ${itemName}`);
                            }
                        } catch (e) {
                            console.warn(`Coflnet failed for ${itemName}, setting to 0:`, e);
                            price = 0;
                        }
                    }
                    
                    this.itemPrices[itemName] = price;
                } catch (error) {
                    console.error(`Error fetching price for ${itemName}:`, error);
                    this.itemPrices[itemName] = 0;
                }
            }
            
            this.updateDropTable();
            
            // Automatically recalculate ROI after updating prices
            this.calculateROI();
            
            this.showStatus('Prices updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating prices:', error);
            this.showStatus('Error updating prices. Some prices may be missing.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateDropTable() {
        if (!this.currentCorpse) return;
        
        const dropItems = this.dropTables[this.currentCorpse];
        const tbody = document.getElementById('dropTableBody');
        tbody.innerHTML = '';
        
        // Use fixed total weight for this corpse type
        const totalWeight = this.corpseMaxWeights[this.currentCorpse];
        const rollsPerCorpse = this.corpseRolls[this.currentCorpse]; // Different rolls per corpse type
        
        dropItems.forEach(item => {
            const price = this.itemPrices[item.name] || 0;
            const totalValue = price * item.quantity;
            const weightPercentage = ((item.weight / totalWeight) * 100).toFixed(2);
            const weightedValuePerRoll = totalValue * (item.weight / totalWeight);
            const weightedValuePerCorpse = weightedValuePerRoll * rollsPerCorpse;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.quantity.toLocaleString()}</td>
                <td title="Max weight for ${this.currentCorpse}: ${totalWeight.toLocaleString()}">${item.weight.toLocaleString()}</td>
                <td>${weightPercentage}%</td>
                <td class="item-price">${this.formatPrice(price)}</td>
                <td class="item-price">${this.formatPrice(totalValue)}</td>
                <td class="item-price">${this.formatPrice(weightedValuePerCorpse)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    calculateROI() {
        if (!this.currentCorpse) {
            this.showStatus('Please select a corpse type first', 'warning');
            return;
        }
        
        const dropItems = this.dropTables[this.currentCorpse];
        if (!dropItems || dropItems.length === 0) {
            this.showStatus('No drop table available for this corpse', 'warning');
            return;
        }
        
        // Use fixed total weight for this corpse type
        const totalWeight = this.corpseMaxWeights[this.currentCorpse];
        const rollsPerCorpse = this.corpseRolls[this.currentCorpse]; // Different rolls per corpse type
        
        // Calculate expected value per roll
        let expectedValuePerRoll = 0;
        dropItems.forEach(item => {
            const price = this.itemPrices[item.name] || 0;
            const totalValue = price * item.quantity;
            const probability = item.weight / totalWeight;
            expectedValuePerRoll += totalValue * probability;
        });
        
        // Calculate expected value for all rolls from one corpse
        const expectedValuePerCorpse = expectedValuePerRoll * rollsPerCorpse;
        
        const profit = expectedValuePerCorpse - this.keyPrice;
        const roiPercentage = this.keyPrice > 0 ? ((profit / this.keyPrice) * 100) : 0;
        
        // Update new results display
        document.getElementById('keyCostDisplay').textContent = this.formatPrice(this.keyPrice);
        document.getElementById('avgRevenueDisplay').textContent = this.formatPrice(expectedValuePerCorpse);
        document.getElementById('expectedProfitDisplay').textContent = this.formatPrice(profit);
        document.getElementById('expectedProfitDisplay').className = `roi-value ${profit >= 0 ? 'positive' : 'negative'}`;
        
        // Update profit indicator
        const profitAmountEl = document.getElementById('profitAmount');
        const profitPercentageEl = document.getElementById('profitPercentage');
        const profitStatusEl = document.getElementById('profitStatus');
        
        profitAmountEl.textContent = (profit >= 0 ? '+' : '') + this.formatPrice(profit);
        profitAmountEl.className = `profit-amount ${profit >= 0 ? 'positive' : 'negative'}`;
        
        profitPercentageEl.textContent = `${roiPercentage >= 0 ? '+' : ''}${roiPercentage.toFixed(1)}%`;
        profitPercentageEl.className = `profit-percentage ${roiPercentage >= 0 ? 'positive' : 'negative'}`;
        
        if (profit >= 0) {
            profitStatusEl.textContent = '✅ Profitable Investment';
            profitStatusEl.className = 'profit-status profitable';
        } else {
            profitStatusEl.textContent = '❌ Losing Investment';
            profitStatusEl.className = 'profit-status unprofitable';
        }
        
        // Show results
        document.getElementById('results').style.display = 'block';
        
        // Show status
        const statusText = profit >= 0 ? 
            `💰 Profitable! Expected profit of ${this.formatPrice(profit)} per key (${roiPercentage.toFixed(1)}% ROI)` :
            `📉 Not profitable. Expected loss of ${this.formatPrice(Math.abs(profit))} per key (${roiPercentage.toFixed(1)}% ROI)`;
        this.showStatus(statusText, profit >= 0 ? 'success' : 'warning');
    }

    sortTable(column) {
        if (!this.currentCorpse) return;
        
        const dropItems = this.dropTables[this.currentCorpse];
        const totalWeight = dropItems.reduce((sum, item) => sum + item.weight, 0);
        
        // Toggle sort direction if same column
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Create sortable data array
        const sortableData = dropItems.map(item => {
            const price = this.itemPrices[item.name] || 0;
            const totalValue = price * item.quantity;
            const totalWeight = this.corpseMaxWeights[this.currentCorpse];
            const weightPercent = (item.weight / totalWeight) * 100;
            const rollsPerCorpse = this.corpseRolls[this.currentCorpse]; // Different rolls per corpse type
            const weightedValue = totalValue * (item.weight / totalWeight) * rollsPerCorpse;
            
            return {
                ...item,
                price,
                total: totalValue,
                weightPercent: weightPercent,
                weighted: weightedValue
            };
        });
        
        // Sort the data
        sortableData.sort((a, b) => {
            let aVal, bVal;
            
            switch (column) {
                case 'item':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'quantity':
                    aVal = a.quantity;
                    bVal = b.quantity;
                    break;
                case 'weight':
                    aVal = a.weight;
                    bVal = b.weight;
                    break;
                case 'weightPercent':
                    aVal = a.weightPercent;
                    bVal = b.weightPercent;
                    break;
                case 'price':
                    aVal = a.price;
                    bVal = b.price;
                    break;
                case 'total':
                    aVal = a.total;
                    bVal = b.total;
                    break;
                case 'weighted':
                    aVal = a.weighted;
                    bVal = b.weighted;
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Update the drop table with sorted data
        this.dropTables[this.currentCorpse] = sortableData;
        this.updateDropTable();
        
        // Update header styling
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        const activeHeader = document.querySelector(`[data-sort="${column}"]`);
        if (activeHeader) {
            activeHeader.classList.add(`sort-${this.sortDirection}`);
        }
    }

    formatPrice(price) {
        if (price === 0) return '0';
        if (price >= 1000000) {
            return (price / 1000000).toFixed(1) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'K';
        } else {
            return Math.round(price).toLocaleString();
        }
    }

    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        const dropTableContainer = document.getElementById('dropTableContainer');
        const resultsEl = document.getElementById('results');
        
        if (show) {
            // Show loading, hide content
            loadingEl.style.display = 'block';
            dropTableContainer.style.display = 'none';
            resultsEl.style.display = 'none';
        } else {
            // Hide loading, show content
            loadingEl.style.display = 'none';
            dropTableContainer.style.display = 'block';
            resultsEl.style.display = 'block';
        }
    }

    showStatus(message, type) {
        const container = document.getElementById('statusContainer');
        
        // Remove existing status messages
        container.innerHTML = '';
        
        const statusDiv = document.createElement('div');
        statusDiv.className = `status ${type}`;
        statusDiv.textContent = message;
        
        container.appendChild(statusDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 5000);
    }

    // Method to add new items to a corpse's loot table
    addDropItem(corpseType, item) {
        if (!this.dropTables[corpseType]) {
            this.dropTables[corpseType] = [];
        }
        this.dropTables[corpseType].push(item);
        
        if (this.currentCorpse === corpseType) {
            this.updateDropTable();
        }
        
        // Save to JSON
        this.saveLootTables();
    }

    // Method to remove an item from a corpse's loot table
    removeDropItem(corpseType, itemName) {
        if (this.dropTables[corpseType]) {
            this.dropTables[corpseType] = this.dropTables[corpseType].filter(item => item.name !== itemName);
            
            if (this.currentCorpse === corpseType) {
                this.updateDropTable();
            }
            
            // Save to JSON
            this.saveLootTables();
        }
    }

    // Method to update an item's weight or quantity
    updateDropItem(corpseType, itemName, updates) {
        if (this.dropTables[corpseType]) {
            const item = this.dropTables[corpseType].find(item => item.name === itemName);
            if (item) {
                Object.assign(item, updates);
                
                if (this.currentCorpse === corpseType) {
                    this.updateDropTable();
                }
                
                // Save to JSON
                this.saveLootTables();
            }
        }
    }

    // Method to save loot tables back to JSON (for future use)
    async saveLootTables() {
        // Note: This would require a server-side endpoint to actually save the file
        // For now, we'll just log the data that would be saved
        const dataToSave = {
            corpseDropTables: this.dropTables,
            keyNames: this.keyNames
        };
        
        console.log('Loot tables would be saved:', JSON.stringify(dataToSave, null, 2));
        
        // You could implement a download feature here instead:
        // this.downloadLootTables(dataToSave);
    }

    // Method to download loot tables as JSON file
    downloadLootTables() {
        const dataToSave = {
            corpseDropTables: this.dropTables,
            keyNames: this.keyNames
        };
        
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'corpse-loot-tables.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}