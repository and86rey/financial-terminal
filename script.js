let varChart, volatilityChart;
const FMP_API_KEY = 'YOUR_FMP_API_KEY'; // Replace with your FMP API key
let requestLedger = JSON.parse(localStorage.getItem('requestLedger')) || [];

function updateLedger(query) {
    const timestamp = new Date().toISOString();
    requestLedger.push({ query, timestamp });
    localStorage.setItem('requestLedger', JSON.stringify(requestLedger));
    displayLedger();
}

function displayLedger() {
    const ledgerList = document.getElementById('ledgerList');
    ledgerList.innerHTML = requestLedger.map(r => `<li>${r.query} - ${r.timestamp}</li>`).join('');
}

// Helper function to calculate rolling VaR (95% confidence)
function calculateRollingVaR(returns) {
    const varValues = [];
    for (let i = 0; i < returns.length; i++) {
        const window = returns.slice(0, i + 1); // Use all prior returns up to current day
        if (window.length < 2) {
            varValues.push(0); // Not enough data for VaR
        } else {
            const sortedWindow = [...window].sort((a, b) => a - b);
            const var95 = sortedWindow[Math.floor(sortedWindow.length * 0.05)] * -1; // 5% tail loss
            varValues.push(var95);
        }
    }
    return varValues;
}

// Helper function to calculate rolling volatility
function calculateRollingVolatility(returns) {
    const volValues = [];
    for (let i = 0; i < returns.length; i++) {
        const window = returns.slice(0, i + 1); // Use all prior returns up to current day
        if (window.length < 2) {
            volValues.push(0); // Not enough data for volatility
        } else {
            const mean = window.reduce((a, b) => a + b, 0) / window.length;
            const variance = window.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / window.length;
            volValues.push(Math.sqrt(variance));
        }
    }
    return volValues;
}

async function fetchData() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    try {
        updateLedger(query);

        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line×eries=5&apikey=${FMP_API_KEY}`;

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => res.json()),
            fetch(historicalUrl).then(res => res.json())
        ]);

        const profileData = profileRes[0] || {};
        const historicalData = historicalRes.historical || [];

        document.getElementById('financialData').innerHTML = `
            <p>Company: ${profileData.companyName || 'N/A'}</p>
            <p>Ticker: ${profileData.symbol || 'N/A'}</p>
            <p>Price: $${profileData.price || 'N/A'}</p>
            <p>Market Cap: $${profileData.mktCap || 'N/A'}</p>
        `;

        // Prepare data
        const dates = historicalData.map(d => d.date).reverse();
        const prices = historicalData.map(d => d.close).reverse();

        // Calculate daily returns
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);

        // Calculate rolling VaR and Volatility
        const rollingVaR = calculateRollingVaR(returns);
        const rollingVolatility = calculateRollingVolatility(returns);

        // Adjust arrays to match dates (first day has no return, so prepend 0)
        const fullDates = dates.slice(1); // Exclude first date since no return for it
        const varWithPrice = [0, ...rollingVaR.map(v => v * prices[prices.length - 1])]; // Scale VaR to price level
        const volWithPrice = [0, ...rollingVolatility];

        if (varChart) varChart.destroy();
        if (volatilityChart) volatilityChart.destroy();

        // VaR Chart
        varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Rolling VaR (95%)',
                        data: varWithPrice,
                        borderColor: '#ff9500',
                        fill: false,
                        pointRadius: 3
                    },
                    {
                        label: 'Price',
                        data: prices,
                        borderColor: '#fff',
                        fill: false,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                scales: { y: { beginAtZero: false } },
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // Volatility Chart
        volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Rolling Volatility',
                        data: volWithPrice,
                        borderColor: '#00cc00',
                        fill: false,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        });

    } catch (error) {
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

window.onload = displayLedger;
