// Cold Resistance Time Calculator
class ColdResistanceCalculator {
    constructor() {
        this.initializeEventListeners();
        // Ensure DOM is ready before initial calculation
        setTimeout(() => this.calculateTime(), 0);
    }

    initializeEventListeners() {
        const resistanceInput = document.getElementById('coldResistance');
        
        if (!resistanceInput) {
            console.warn('Cold resistance input not found, retrying...');
            setTimeout(() => this.initializeEventListeners(), 100);
            return;
        }

        // Auto-calculate on input change
        resistanceInput.addEventListener('input', () => {
            this.calculateTime();
        });

        // Validate input and calculate on change
        resistanceInput.addEventListener('change', (e) => {
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
        const resistanceInput = document.getElementById('coldResistance');
        const timeDisplay = document.getElementById('timeDisplay');
        
        if (!resistanceInput || !timeDisplay) {
            console.warn('Calculator elements not found, retrying...');
            setTimeout(() => this.calculateTime(), 100);
            return;
        }
        
        const coldResistance = parseInt(resistanceInput.value) || 0;
        console.log(`Input: ${coldResistance} cold resistance`);
        
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
        
        console.log(`Calculated: ${results.timeDisplay} (${totalTimeSeconds.toFixed(1)} seconds)`);
        this.displayResults(results);
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (seconds < 31536000) {
            const days = Math.floor(seconds / 86400);
            const remainingHours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${days}d ${remainingHours}h ${minutes}m`;
        } else {
            const years = Math.floor(seconds / 31536000);
            const remainingDays = Math.floor((seconds % 31536000) / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            return `${years}y ${remainingDays}d ${hours}h`;
        }
    }

    displayResults(results) {
        const timeElement = document.getElementById('timeDisplay');
        
        if (timeElement) {
            // Update only the time display
            timeElement.textContent = results.timeDisplay;
            
            // Highlight the time result
            timeElement.classList.add('highlight');
        } else {
            console.error('ERROR: timeDisplay element not found - cannot update display');
        }
    }
}

// Initialize the calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing calculator...');
    try {
        window.coldResistanceCalculator = new ColdResistanceCalculator();
        console.log('Calculator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize calculator:', error);
    }
});