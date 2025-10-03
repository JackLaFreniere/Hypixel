// Cold Resistance Calculator
class ColdResistanceCalculator {
    constructor() {
        this.areaRequirements = {
            'ice_walker_cave': {
                name: 'Ice Walker Cave',
                requiredResistance: 100,
                description: 'A cold cave where ice walkers roam. Basic cold resistance required.',
                tips: [
                    'Entry-level cold area',
                    'Good for testing basic cold resistance gear',
                    'Contains basic cold-resistant materials'
                ]
            },
            'dwarven_mines': {
                name: 'Dwarven Mines',
                requiredResistance: 200,
                description: 'Deep underground mines with varying cold temperatures.',
                tips: [
                    'Moderate cold resistance required',
                    'Some areas colder than others',
                    'Important for mining progression'
                ]
            },
            'crystal_hollows': {
                name: 'Crystal Hollows',
                requiredResistance: 300,
                description: 'Crystalline caves with intense cold in certain areas.',
                tips: [
                    'High cold resistance needed in ice areas',
                    'Variable temperature depending on biome',
                    'Essential for crystal mining'
                ]
            },
            'glacite_tunnels': {
                name: 'Glacite Tunnels',
                requiredResistance: 500,
                description: 'Extremely cold tunnels requiring maximum cold protection.',
                tips: [
                    'Highest cold resistance requirement',
                    'Specialized gear necessary',
                    'End-game cold content'
                ]
            }
        };

        this.gearDatabase = {
            // Armor pieces that provide cold resistance
            armor: [
                {
                    name: 'Glacite Armor',
                    type: 'Full Set',
                    resistance: 200,
                    description: 'Specialized cold resistance armor set',
                    requirements: 'Mining 50, Combat 40'
                },
                {
                    name: 'Yeti Armor',
                    type: 'Full Set',
                    resistance: 150,
                    description: 'Provides cold immunity and resistance',
                    requirements: 'Combat 35'
                },
                {
                    name: 'Cold Resistance Chestplate',
                    type: 'Chestplate',
                    resistance: 75,
                    description: 'Basic cold resistance chestplate',
                    requirements: 'Combat 20'
                },
                {
                    name: 'Frost Walker Boots',
                    type: 'Boots',
                    resistance: 50,
                    description: 'Boots that provide cold resistance',
                    requirements: 'Combat 15'
                }
            ],
            // Accessories that provide cold resistance
            accessories: [
                {
                    name: 'Cold Resistance Ring',
                    type: 'Ring',
                    resistance: 25,
                    description: 'Ring that provides cold resistance',
                    requirements: 'Combat 10'
                },
                {
                    name: 'Frostbite Talisman',
                    type: 'Talisman',
                    resistance: 30,
                    description: 'Talisman with cold protection',
                    requirements: 'Combat 15'
                },
                {
                    name: 'Ice Crystal',
                    type: 'Accessory',
                    resistance: 40,
                    description: 'Crystal that provides cold immunity',
                    requirements: 'Mining 25'
                }
            ],
            // Consumables and temporary resistance
            consumables: [
                {
                    name: 'Cold Resistance Potion',
                    type: 'Potion',
                    resistance: 100,
                    duration: '8 minutes',
                    description: 'Temporary cold resistance boost',
                    requirements: 'Alchemy 20'
                },
                {
                    name: 'Frost Immunity Potion',
                    type: 'Potion',
                    resistance: 200,
                    duration: '5 minutes',
                    description: 'High temporary cold resistance',
                    requirements: 'Alchemy 35'
                }
            ]
        };

        this.initializeEventListeners();
        this.updateAreaInfo();
    }

    initializeEventListeners() {
        // Target area selection
        document.getElementById('targetArea').addEventListener('change', (e) => {
            this.updateAreaInfo(e.target.value);
            this.updateTargetResistance(e.target.value);
        });

        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.calculateResistance();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCalculator();
        });

        // Auto-calculate on input changes
        document.getElementById('currentResistance').addEventListener('input', () => {
            this.calculateResistance();
        });

        document.getElementById('targetResistance').addEventListener('input', () => {
            this.calculateResistance();
        });
    }

    updateAreaInfo(areaKey = '') {
        const areaInfoDiv = document.getElementById('areaInfo');
        
        if (!areaKey || !this.areaRequirements[areaKey]) {
            areaInfoDiv.innerHTML = '<p>Select an area to see cold resistance requirements and tips.</p>';
            return;
        }

        const area = this.areaRequirements[areaKey];
        
        areaInfoDiv.innerHTML = `
            <h3>${area.name}</h3>
            <p><strong>Required Cold Resistance:</strong> ${area.requiredResistance}</p>
            <p><strong>Description:</strong> ${area.description}</p>
            <h4>Tips:</h4>
            <ul>
                ${area.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        `;
    }

    updateTargetResistance(areaKey) {
        if (areaKey && this.areaRequirements[areaKey]) {
            document.getElementById('targetResistance').value = this.areaRequirements[areaKey].requiredResistance;
            this.calculateResistance();
        }
    }

    calculateResistance() {
        const currentResistance = parseInt(document.getElementById('currentResistance').value) || 0;
        const targetResistance = parseInt(document.getElementById('targetResistance').value) || 0;

        // Update display values
        document.getElementById('requiredResistanceDisplay').textContent = targetResistance;
        document.getElementById('currentResistanceDisplay').textContent = currentResistance;

        // Calculate resistance gap
        const resistanceGap = targetResistance - currentResistance;
        document.getElementById('resistanceGapDisplay').textContent = resistanceGap;

        // Determine status
        let status = 'Not Calculated';
        let statusClass = '';

        if (targetResistance > 0) {
            if (currentResistance >= targetResistance) {
                status = 'Sufficient ✓';
                statusClass = 'status-safe';
            } else if (currentResistance >= targetResistance * 0.8) {
                status = 'Close ⚠';
                statusClass = 'status-warning';
            } else {
                status = 'Insufficient ✗';
                statusClass = 'status-danger';
            }
        }

        const statusElement = document.getElementById('resistanceStatusDisplay');
        statusElement.textContent = status;
        statusElement.className = `summary-value ${statusClass}`;

        // Update gear recommendations
        this.updateGearRecommendations(resistanceGap);
    }

    updateGearRecommendations(resistanceGap) {
        const gearDiv = document.getElementById('gearRecommendations');

        if (resistanceGap <= 0) {
            gearDiv.innerHTML = `
                <div class="gear-item">
                    <h4>✓ Cold Resistance Sufficient</h4>
                    <p>You have enough cold resistance for your target area!</p>
                </div>
            `;
            return;
        }

        // Find gear combinations that can fill the gap
        const recommendations = this.findGearRecommendations(resistanceGap);
        
        if (recommendations.length === 0) {
            gearDiv.innerHTML = `
                <div class="gear-item">
                    <h4>⚠ High Resistance Needed</h4>
                    <p>You need ${resistanceGap} more cold resistance. Consider multiple gear pieces and potions.</p>
                </div>
            `;
            return;
        }

        gearDiv.innerHTML = recommendations.map(rec => `
            <div class="gear-item">
                <h4>${rec.name}</h4>
                <p><strong>Type:</strong> ${rec.type}</p>
                <p><strong>Cold Resistance:</strong> +${rec.resistance}</p>
                <p><strong>Description:</strong> ${rec.description}</p>
                <p><strong>Requirements:</strong> ${rec.requirements}</p>
                ${rec.duration ? `<p><strong>Duration:</strong> ${rec.duration}</p>` : ''}
            </div>
        `).join('');
    }

    findGearRecommendations(neededResistance) {
        const allGear = [
            ...this.gearDatabase.armor,
            ...this.gearDatabase.accessories,
            ...this.gearDatabase.consumables
        ];

        // Sort by resistance value (highest first)
        allGear.sort((a, b) => b.resistance - a.resistance);

        // Find gear that provides enough resistance
        const recommendations = [];

        // Add items that can cover the full gap
        allGear.forEach(item => {
            if (item.resistance >= neededResistance) {
                recommendations.push(item);
            }
        });

        // If no single item covers the gap, add the highest resistance items
        if (recommendations.length === 0) {
            recommendations.push(...allGear.slice(0, 3));
        }

        // Limit recommendations to avoid overwhelming the user
        return recommendations.slice(0, 6);
    }

    clearCalculator() {
        // Clear all inputs
        document.getElementById('targetArea').value = '';
        document.getElementById('currentResistance').value = '';
        document.getElementById('targetResistance').value = '';

        // Reset displays
        document.getElementById('requiredResistanceDisplay').textContent = '0';
        document.getElementById('currentResistanceDisplay').textContent = '0';
        document.getElementById('resistanceGapDisplay').textContent = '0';
        
        const statusElement = document.getElementById('resistanceStatusDisplay');
        statusElement.textContent = 'Not Calculated';
        statusElement.className = 'summary-value';

        // Clear area info
        this.updateAreaInfo();

        // Clear gear recommendations
        document.getElementById('gearRecommendations').innerHTML = '<p>Calculate resistance to see gear recommendations.</p>';
    }

    // Utility method to get area requirement by name
    getAreaRequirement(areaName) {
        for (const [key, area] of Object.entries(this.areaRequirements)) {
            if (area.name.toLowerCase() === areaName.toLowerCase()) {
                return area;
            }
        }
        return null;
    }

    // Method to add custom gear (for future expansion)
    addCustomGear(category, gearItem) {
        if (this.gearDatabase[category]) {
            this.gearDatabase[category].push(gearItem);
        }
    }

    // Method to get all gear of a specific type
    getGearByType(type) {
        const allGear = [
            ...this.gearDatabase.armor,
            ...this.gearDatabase.accessories,
            ...this.gearDatabase.consumables
        ];

        return allGear.filter(item => item.type.toLowerCase() === type.toLowerCase());
    }

    // Method to calculate total resistance from multiple items
    calculateTotalResistance(gearItems) {
        return gearItems.reduce((total, item) => total + item.resistance, 0);
    }
}

// Initialize the calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.coldResistanceCalculator = new ColdResistanceCalculator();
    console.log('Cold Resistance Calculator initialized');
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColdResistanceCalculator;
}