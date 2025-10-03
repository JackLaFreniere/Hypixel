class CrystalCalculator {
    constructor() {
        console.log('CrystalCalculator constructor called');
        try {
            this.bazaarAPI = window.globalBazaarAPI || new HypixelBazaarAPI();
            this.coflnetAPI = window.globalCoflnetAPI || new CoflnetAuctionAPI();
            console.log('APIs assigned successfully');
        } catch (error) {
            console.error('Error assigning APIs:', error);
        }
        
        // Define all 12 gemstone types for Hypixel Skyblock
        this.gemstones = [
            'amber', 'amethyst', 'jade', 'sapphire', 'ruby', 'topaz',
            'jasper', 'opal', 'aquamarine', 'citrine', 'onyx', 'peridot'
        ];
        
        this.flawedQuantity = 32000; // 32k flawed gemstones needed for 1 perfect
        this.fineQuantity = 400; // 400 fine gemstones needed for 1 perfect
        this.gemstoneData = {};
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.isCalculating = false;
        
        // Make this accessible globally for other JS files
        window.crystalCalculator = this;
        window.crystalData = this.gemstoneData;
        
        console.log('CrystalCalculator constructor completed');
    }

    // Public method to get current gemstone data for other modules
    getGemstoneData() {
        return this.gemstoneData;
    }

    // Public method to get specific gemstone info
    getGemstoneInfo(gemstone) {
        return this.gemstoneData[gemstone] || null;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    formatCoins(amount) {
        if (amount >= 0) {
            return '+' + this.formatNumber(Math.round(amount));
        } else {
            return '-' + this.formatNumber(Math.abs(Math.round(amount)));
        }
    }

    async autoCalculate() {
        if (this.isCalculating) {
            console.log('Already calculating, skipping...');
            return;
        }

        this.isCalculating = true;
        console.log('Starting auto calculation...');
        
        // Show loading
        this.showLoading(true);
        this.showStatus('Calculating gemstone conversions...', 'warning');
        
        try {
            // Initialize gemstone data
            this.initializeGemstoneData();
            
            // Update prices for all gemstones
            await this.updateAllPrices();
            
            // Calculate profits
            this.calculateProfits();
            
            // Update UI
            this.updateTable();
            this.updateSummary();
            
            this.showStatus('Calculation completed successfully!', 'success');
            console.log('Final gemstone data:', this.gemstoneData);
        } catch (error) {
            console.error('Error during calculation:', error);
            this.showStatus('Error during calculation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            this.isCalculating = false;
        }
    }

    initializeGemstoneData() {
        this.gemstoneData = {};
        this.gemstones.forEach(gemstone => {
            this.gemstoneData[gemstone] = {
                name: gemstone,
                flawedPrice: 0,
                finePrice: 0,
                perfectPrice: 0,
                flawedTotal: 0,
                fineTotal: 0,
                bestMethod: 'Loading...',
                bestCost: 0,
                profit: 0,
                status: 'Loading...'
            };
        });
        
        // Update global reference
        window.crystalData = this.gemstoneData;
    }

    async updateAllPrices() {
        console.log('Updating all gemstone prices...');
        
        const promises = this.gemstones.map(gemstone => this.updateGemstonePrice(gemstone));
        
        await Promise.allSettled(promises);
        console.log('All price updates completed');
    }

    async updateGemstonePrice(gemstone) {
        try {
            // Get flawed gemstone price (e.g., "FLAWED_RUBY_GEM")
            const flawedName = `FLAWED_${gemstone.toUpperCase()}_GEM`;
            const flawedPrice = await this.getItemPrice(flawedName);
            
            // Get fine gemstone price (e.g., "FINE_RUBY_GEM")
            const fineName = `FINE_${gemstone.toUpperCase()}_GEM`;
            const finePrice = await this.getItemPrice(fineName);
            
            // Get perfect gemstone price (e.g., "PERFECT_RUBY_GEM")
            const perfectName = `PERFECT_${gemstone.toUpperCase()}_GEM`;
            const perfectPrice = await this.getItemPrice(perfectName);
            
            // Update data
            if (this.gemstoneData[gemstone]) {
                this.gemstoneData[gemstone].flawedPrice = flawedPrice;
                this.gemstoneData[gemstone].finePrice = finePrice;
                this.gemstoneData[gemstone].perfectPrice = perfectPrice;
                this.gemstoneData[gemstone].flawedTotal = flawedPrice * this.flawedQuantity;
                this.gemstoneData[gemstone].fineTotal = finePrice * this.fineQuantity;
                
                console.log(`Updated ${gemstone}: flawed=${flawedPrice}, fine=${finePrice}, perfect=${perfectPrice}`);
            }
            
        } catch (error) {
            console.error(`Error updating price for ${gemstone}:`, error);
            if (this.gemstoneData[gemstone]) {
                this.gemstoneData[gemstone].status = 'Error';
            }
        }
    }

    async getItemPrice(itemName) {
        try {
            // Try bazaar first
            const bazaarPrice = await this.bazaarAPI.getInstaSellPrice(itemName);
            if (bazaarPrice > 0) {
                return bazaarPrice;
            }
            
            // If not available in bazaar, try auction house
            console.log(`${itemName} not found in bazaar, trying auction house...`);
            const auctionPrice = await this.coflnetAPI.getAveragePrice(itemName);
            if (auctionPrice > 0) {
                return auctionPrice;
            }
            
            console.warn(`No price found for ${itemName}`);
            return 0;
            
        } catch (error) {
            console.error(`Error getting price for ${itemName}:`, error);
            return 0;
        }
    }

    calculateProfits() {
        console.log('Calculating profits...');
        
        Object.values(this.gemstoneData).forEach(data => {
            if (data.perfectPrice > 0) {
                // Calculate costs for both methods
                const flawedCost = data.flawedTotal;
                const fineCost = data.fineTotal;
                
                // Determine best method (lowest cost, but only if price > 0)
                let bestCost = 0;
                let bestMethod = 'No Data';
                
                if (flawedCost > 0 && fineCost > 0) {
                    if (flawedCost <= fineCost) {
                        bestCost = flawedCost;
                        bestMethod = `32k Flawed (${this.formatNumber(data.flawedPrice)} each)`;
                    } else {
                        bestCost = fineCost;
                        bestMethod = `400 Fine (${this.formatNumber(data.finePrice)} each)`;
                    }
                } else if (flawedCost > 0) {
                    bestCost = flawedCost;
                    bestMethod = `32k Flawed (${this.formatNumber(data.flawedPrice)} each)`;
                } else if (fineCost > 0) {
                    bestCost = fineCost;
                    bestMethod = `400 Fine (${this.formatNumber(data.finePrice)} each)`;
                }
                
                // Calculate profit using best method
                data.bestMethod = bestMethod;
                data.bestCost = bestCost;
                data.profit = bestCost > 0 ? data.perfectPrice - bestCost : 0;
                data.status = data.profit > 0 ? 'Profitable' : data.profit < 0 ? 'Unprofitable' : 'Break Even';
            } else {
                data.bestMethod = 'No Data';
                data.bestCost = 0;
                data.profit = 0;
                data.status = 'No Perfect Price';
            }
        });
        
        console.log('Profit calculation completed');
    }

    updateTable() {
        const tableBody = document.getElementById('gemstoneTableBody');
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Sort data if needed
        let sortedData = Object.values(this.gemstoneData);
        if (this.sortColumn) {
            sortedData = this.sortData(sortedData, this.sortColumn, this.sortDirection);
        }
        
        // Create rows
        sortedData.forEach(data => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td class="gemstone-name">${data.name}</td>
                <td class="price-cell">${data.flawedPrice > 0 ? this.formatNumber(data.flawedPrice) : 'N/A'}</td>
                <td class="price-cell">${data.finePrice > 0 ? this.formatNumber(data.finePrice) : 'N/A'}</td>
                <td class="method-cell">${data.bestMethod}</td>
                <td class="price-cell">${data.bestCost > 0 ? this.formatNumber(data.bestCost) : 'N/A'}</td>
                <td class="price-cell">${data.perfectPrice > 0 ? this.formatNumber(data.perfectPrice) : 'N/A'}</td>
                <td class="profit-cell ${data.profit > 0 ? 'positive' : data.profit < 0 ? 'negative' : ''}">${this.formatCoins(data.profit)}</td>
                <td class="status-cell ${data.status === 'Profitable' ? 'status-profitable' : data.status === 'Unprofitable' ? 'status-unprofitable' : 'status-loading'}">${data.status}</td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Update global reference after table update
        window.crystalData = this.gemstoneData;
    }

    updateSummary() {
        const profitableGemstones = Object.values(this.gemstoneData).filter(data => data.profit > 0);
        const bestProfit = Math.max(...Object.values(this.gemstoneData).map(data => data.profit));
        const bestGemstone = Object.values(this.gemstoneData).find(data => data.profit === bestProfit);
        
        const investments = Object.values(this.gemstoneData)
            .filter(data => data.bestCost > 0)
            .map(data => data.bestCost);
        
        const minInvestment = investments.length > 0 ? Math.min(...investments) : 0;
        const maxInvestment = investments.length > 0 ? Math.max(...investments) : 0;
        
        // Calculate best ROI for display
        const bestROI = Math.max(...Object.values(this.gemstoneData).map(data => 
            data.bestCost > 0 ? (data.profit / data.bestCost) * 100 : 0
        ));
        
        // Update UI elements
        document.getElementById('bestProfitAmount').textContent = this.formatCoins(bestProfit);
        document.getElementById('bestProfitGemstone').textContent = bestGemstone ? bestGemstone.name : 'No data';
        document.getElementById('profitableCount').textContent = profitableGemstones.length;
        document.getElementById('investmentRange').textContent = `${this.formatNumber(minInvestment)} - ${this.formatNumber(maxInvestment)}`;
        document.getElementById('bestROI').textContent = bestROI.toFixed(1) + '%';
        
        // Update profit status
        const profitStatus = document.getElementById('profitStatus');
        if (bestProfit > 0) {
            profitStatus.textContent = `${profitableGemstones.length} profitable conversion${profitableGemstones.length !== 1 ? 's' : ''} found`;
            profitStatus.className = 'profit-status profitable';
        } else {
            profitStatus.textContent = 'No profitable conversions found';
            profitStatus.className = 'profit-status unprofitable';
        }
        
        // Update profit amount color
        const profitAmount = document.getElementById('bestProfitAmount');
        profitAmount.className = bestProfit > 0 ? 'profit-amount positive' : 'profit-amount negative';
    }

    sortTable(column) {
        // Toggle sort direction if clicking the same column
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Update table headers
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === column) {
                th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
        
        // Re-render table
        this.updateTable();
    }

    sortData(data, column, direction) {
        return data.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];
            
            // Handle numeric values
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            // Handle string values
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
            
            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }

    showStatus(message, type = 'info') {
        const container = document.getElementById('statusContainer');
        if (!container) return;
        
        // Clear existing status messages
        container.innerHTML = '';
        
        const statusDiv = document.createElement('div');
        statusDiv.className = `status ${type}`;
        statusDiv.textContent = message;
        
        container.appendChild(statusDiv);
        
        // Auto-remove after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 5000);
        }
    }
}