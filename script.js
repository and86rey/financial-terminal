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

async function fetchData() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    try {
        // Update ledger
        updateLedger(query);

        // Fetch data from FMP API
        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line×eries=5&apikey=${FMP_API_KEY}`;

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => res.json()),
            fetch(historicalUrl).then(res => res.json())
        ]);

        const profileData = profileRes[0] || {};
        const historicalData = historicalRes.historical || [];

        // Display financial data
        document.getElementById('financialData').innerHTML = `
            <p>Company: ${profileData.companyName || 'N/A'}</p>
            <p>Ticker: ${profileData.symbol || 'N/A'}</p>
            <p>Price: $${profileData.price || 'N/A'}</p>
            <p>Market Cap: $${profileData.mktCap || 'N/A'}</p>
        `;

        // Prepare graph data
        const dates = historicalData.map(d => d.date).reverse();
        const prices = historicalData.map(d => d.close).reverse();

        // Calculate VaR (95% confidence, simple historical)
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)] * -1;

        // Calculate Volatility
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);

        // Destroy existing charts
        if (varChart) varChart.destroy();
        if (volatilityChart) volatilityChart.destroy();

        // VaR Chart
        varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'VaR (95%)',
                    data: prices.map(() => var95 * prices[prices.length - 1]),
                    borderColor: '#ff9500',
                    fill: false
                }, {
                    label: 'Price',
                    data: prices,
                    borderColor: '#fff',
                    fill: false
                }]
            },
            options: { scales: { y: { beginAtZero: false } }, responsive: true }
        });

        // Volatility Chart
        volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Volatility',
                    data: prices.map(() => volatility),
                    borderColor: '#00cc00',
                    fill: false
                }]
            },
            options: { scales: { y: { beginAtZero: false } }, responsive: true }
        });

    } catch (error) {
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

// Load ledger on page load
window.onload = displayLedger;
