let varChart, volatilityChart;
const FMP_API_KEY = 'WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI'; // Replace with your FMP API key
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

// Rolling VaR (95% confidence) over a 20-day window
function calculateRollingVaR(returns, windowSize = 20) {
    const varValues = [];
    for (let i = 0; i < returns.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = returns.slice(start, i + 1);
        if (window.length < 5) { // Minimum data for meaningful VaR
            varValues.push(0);
        } else {
            const sortedWindow = [...window].sort((a, b) => a - b);
            const var95 = sortedWindow[Math.floor(sortedWindow.length * 0.05)] * -1; // 5% tail loss
            varValues.push(var95);
        }
    }
    return varValues;
}

// Rolling Volatility over a 20-day window
function calculateRollingVolatility(returns, windowSize = 20) {
    const volValues = [];
    for (let i = 0; i < returns.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = returns.slice(start, i + 1);
        if (window.length < 5) { // Minimum data for meaningful volatility
            volValues.push(0);
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
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line&apikey=${FMP_API_KEY}`; // Full history

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => res.json()),
            fetch(historicalUrl).then(res => res.json())
        ]);

        const profileData = profileRes[0] || {};
        const historicalData = historicalRes.historical || [];

        // Limit to last 252 days (1 trading year)
        const limitedData = historicalData.slice(0, 252).reverse();
        if (limitedData.length < 2) throw new Error('Not enough historical data');

        document.getElementById('financialData').innerHTML = `
            <p>Company: ${profileData.companyName || 'N/A'}</p>
            <p>Ticker: ${profileData.symbol || 'N/A'}</p>
            <p>Price: $${profileData.price || 'N/A'}</p>
            <p>Market Cap: $${profileData.mktCap || 'N/A'}</p>
        `;

        // Prepare data
        const dates = limitedData.map(d => d.date);
        const prices = limitedData.map(d => d.close);

        // Calculate daily returns
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);

        // Calculate rolling metrics
        const rollingVaR = calculateRollingVaR(returns);
        const rollingVolatility = calculateRollingVolatility(returns);

        // Align arrays with dates (prepend 0 for first day with no return)
        const fullVaR = [0, ...rollingVaR.map(v => v * prices[prices.length - 1])]; // Scale VaR to price
        const fullVolatility = [0, ...rollingVolatility];
        const fullDates = dates;

        if (varChart) varChart.destroy();
        if (volatilityChart) volatilityChart.destroy();

        // VaR Chart with Price
        varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: fullDates,
                datasets: [
                    {
                        label: 'Rolling VaR (95%, 20-day)',
                        data: fullVaR,
                        borderColor: '#ff9500',
                        fill: false,
                        pointRadius: 0, // Cleaner line for long data
                        borderWidth: 1
                    },
                    {
                        label: 'Price',
                        data: prices,
                        borderColor: '#fff',
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                scales: {
                    x: { display: true, title: { display: true, text: 'Date' } },
                    y: { beginAtZero: false, title: { display: true, text: 'Value ($)' } }
                },
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });

        // Volatility Chart
        volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: full
