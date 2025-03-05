let varChart, volatilityChart;
const FMP_API_KEY = 'WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI'; // Replace with your FMP API key
let requestLedger = JSON.parse(localStorage.getItem('requestLedger')) || [];
let fullDates = [], fullPrices = [], fullVaR = [], fullVolatility = [];
let zoomLevel = 1; // 1 = full view, higher = zoomed in

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

function calculateRollingVaR(returns, windowSize = 20) {
    const varValues = [];
    for (let i = 0; i < returns.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = returns.slice(start, i + 1);
        if (window.length < 5) {
            varValues.push(0);
        } else {
            const sortedWindow = [...window].sort((a, b) => a - b);
            const var95 = sortedWindow[Math.floor(sortedWindow.length * 0.05)] * -1;
            varValues.push(var95);
        }
    }
    return varValues;
}

function calculateRollingVolatility(returns, windowSize = 20) {
    const volValues = [];
    for (let i = 0; i < returns.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = returns.slice(start, i + 1);
        if (window.length < 5) {
            volValues.push(0);
        } else {
            const mean = window.reduce((a, b) => a + b, 0) / window.length;
            const variance = window.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / window.length;
            volValues.push(Math.sqrt(variance));
        }
    }
    return volValues;
}

function updateCharts() {
    const dataLength = fullDates.length;
    const visibleDays = Math.floor(252 / zoomLevel); // Adjust visible range
    const startIndex = Math.max(0, dataLength - visibleDays);

    const visibleDates = fullDates.slice(startIndex);
    const visiblePrices = fullPrices.slice(startIndex);
    const visibleVaR = fullVaR.slice(startIndex);
    const visibleVolatility = fullVolatility.slice(startIndex);

    // Set tick size (max 12 ticks)
    const tickInterval = Math.ceil(visibleDates.length / 12);
    const ticks = visibleDates.filter((_, i) => i % tickInterval === 0);

    if (varChart) varChart.destroy();
    if (volatilityChart) volatilityChart.destroy();

    varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [
                {
                    label: 'Rolling VaR (95%, 20-day)',
                    data: visibleVaR,
                    borderColor: '#ff9500',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                },
                {
                    label: 'Price',
                    data: visiblePrices,
                    borderColor: '#fff',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, callback: (value, index) => ticks[index] || '' },
                    title: { display: true, text: 'Date' }
                },
                y: { beginAtZero: false, title: { display: true, text: 'Value ($)' } }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });

    volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [
                {
                    label: 'Rolling Volatility (20-day)',
                    data: visibleVolatility,
                    borderColor: '#00cc00',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, callback: (value, index) => ticks[index] || '' },
                    title: { display: true, text: 'Date' }
                },
                y: { beginAtZero: true, title: { display: true, text: 'Volatility' } }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });
}

async function fetchData() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    try {
        updateLedger(query);

        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line&apikey=${FMP_API_KEY}`;

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => { if (!res.ok) throw new Error('Profile API failed'); return res.json(); }),
            fetch(historicalUrl).then(res => { if (!res.ok) throw new Error('Historical API failed'); return res.json(); })
        ]);

        const profileData = profileRes[0] || {};
        const historicalData = historicalRes.historical || [];
        if (!historicalData.length) throw new Error('No historical data returned');

        const limitedData = historicalData.slice(0, Math.min(252, historicalData.length)).reverse();
        if (limitedData.length < 2) throw new Error('Insufficient historical data');

        document.getElementById('financialData').innerHTML = `
            <p>Company: ${profileData.companyName || 'N/A'}</p>
            <p>Ticker: ${profileData.symbol || 'N/A'}</p>
            <p>Price: $${profileData.price || 'N/A'}</p>
            <p>Market Cap: $${profileData.mktCap || 'N/A'}</p>
        `;

        fullDates = limitedData.map(d => d.date);
        fullPrices = limitedData.map(d => d.close);
        const returns = fullPrices.slice(1).map((p, i) => (p - fullPrices[i]) / fullPrices[i]);
        const rollingVaR = calculateRollingVaR(returns);
        const rollingVolatility = calculateRollingVolatility(returns);
        fullVaR = [0, ...rollingVaR.map(v => v * fullPrices[fullPrices.length - 1])];
        fullVolatility = [0, ...rollingVolatility];

        zoomLevel = 1; // Reset zoom on new search
        updateCharts();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 1, 5); // Max zoom level 5x
    updateCharts();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 1, 1); // Min zoom level 1x
    updateCharts();
}

// Event listeners
window.onload = () => {
    displayLedger();
    document.getElementById('searchButton').addEventListener('click', fetchData);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchData();
    });
};
