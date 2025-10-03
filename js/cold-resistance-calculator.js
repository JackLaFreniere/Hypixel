// Cold Resistance Time Calculator
class ColdResistanceCalculator {
    constructor() {
        this.initializeEventListeners();
        this.calculateTime(); // Initial calculation with default value
    }

    initializeEventListeners() {
        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.calculateTime();
        });

        // Auto-calculate on input change
        document.getElementById('coldResistance').addEventListener('input', () => {
            this.calculateTime();
        });

        // Validate input
        document.getElementById('coldResistance').addEventListener('change', (e) => {
            this.validateInput(e.target);
        });
    }

    validateInput(input) {
        let value = parseInt(input.value);
        
        // Ensure value is valid (no negative values)
        if (isNaN(value) || value < 0) {
            value = 0;
        }
        
        input.value = value;
        this.calculateTime();
    }

    calculateTime() {
        const coldResistance = parseInt(document.getElementById('coldResistance').value) || 0;
        
        // We need to gain 100 cold (starting from 0)
        const coldNeeded = 100;
        
        // Base time: 5 seconds per cold (without any resistance)
        const baseTimeSeconds = coldNeeded * 5; // 500 seconds = 8m 20s
        
        // Calculate total time with resistance penalty
        // Each point of cold resistance makes it take 1% longer to gain cold
        // Formula: base_time * (1 + cold_resistance/100)
        const resistancePenaltyMultiplier = 1 + (coldResistance / 100);
        const totalTimeSeconds = baseTimeSeconds * resistancePenaltyMultiplier;
        
        // Calculate penalty
        const penaltySeconds = totalTimeSeconds - baseTimeSeconds;
        const penaltyPercentage = (coldResistance); // Since each point = 1%
        
        // Format results - only need the time display now
        const results = {
            timeDisplay: this.formatTime(totalTimeSeconds)
        };
        
        this.displayResults(results);
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.round(seconds % 60);
            
            if (hours < 24) {
                return `${hours}h ${minutes}m ${remainingSeconds}s`;
            } else {
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                return `${days}d ${remainingHours}h ${minutes}m`;
            }
        }
    }

    displayResults(results) {
        // Update only the time display
        document.getElementById('timeDisplay').textContent = results.timeDisplay;
        
        // Highlight the time result
        const timeElement = document.getElementById('timeDisplay');
        if (results.timeDisplay !== "Enter cold resistance to calculate") {
            timeElement.classList.add('highlight');
        } else {
            timeElement.classList.remove('highlight');
        }
    }

    // Utility method to get calculation breakdown
    getCalculationBreakdown(coldResistance) {
        const baseTime = 100 * 5; // 500 seconds
        const penaltyMultiplier = 1 + (coldResistance / 100);
        const totalTime = baseTime * penaltyMultiplier;
        const penalty = totalTime - baseTime;
        
        return {
            coldResistance: coldResistance,
            baseTimeSeconds: baseTime,
            penaltyMultiplier: penaltyMultiplier,
            penaltySeconds: penalty,
            penaltyPercentage: coldResistance,
            totalTimeSeconds: totalTime,
            explanation: `With ${coldResistance} cold resistance, each cold takes ${(5 * penaltyMultiplier).toFixed(2)} seconds instead of 5 seconds.`
        };
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