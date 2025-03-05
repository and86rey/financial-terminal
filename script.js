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

async function fetchData() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    try {
        updateLedger(query);

        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line&apikey=${FMP_API_KEY}`;

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => {
                if (!res.ok) throw new Error('Profile API failed');
                return res.json();
            }),
            fetch(historicalUrl).then(res => {
                if (!res.ok) throw new Error('Historical API failed');
                return res.json();
            })
        ]);

        const profileData = profileRes[0] || {};
        const historicalData = historicalRes.historical || [];
        
        if (!historicalData.length) throw new Error('No historical data returned');

        // Limit to last 252 days or available data
        const limitedData = historicalData.slice(0, Math.min(252, historicalData.length)).reverse();
        if (limitedData.length < 2) throw new Error('Insufficient historical data');

        document.getElementById('financialData').innerHTML = `
            <p>Company: ${profileData.companyName || 'N/A'}</p>
            <p>Ticker: ${profileData.symbol || 'N/A'}</p>
            <p>Price: $${profileData.price || 'N/A'}</p>
            <p>Market Cap: $${profileData.mktCap || 'N/A'}</p>
        `;

        const dates = limitedData.map(d => d.date);
        const prices = limitedData.map(d => d.close);

        console.log('Dates:', dates); // Debug
        console.log('Prices:', prices); // Debug

        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        console.log('Returns:', returns); // Debug

        const rollingVaR = calculateRollingVaR(returns);
        const rollingVolatility = calculateRollingVolatility(returns);

        const fullVaR = [0, ...rollingVaR.map(v => v * prices[prices.length - 1])];
        const fullVolatility = [0, ...rollingVolatility];
        console.log('VaR:', fullVaR); // Debug
        console.log('Volatility:', fullVolatility); // Debug

        if (varChart) varChart.destroy();
        if (volatilityChart) volatilityChart.destroy();

        varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Rolling VaR (95%, 20-day)',
                        data: fullVaR,
                        borderColor: '#ff9500',
                        fill: false,
                        pointRadius: 0,
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
                plugins: { tooltip: { mode: 'index', intersect: false } }
            }
        });

        volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Rolling Volatility (20-day)',
                        data: fullVolatility,
                        borderColor: '#00cc00',
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                scales: {
                    x: { display: true, title: { display: true, text: 'Date' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Volatility' } }
                },
                responsive: true,
                maintainAspectRatio: false,
                plugins: { tooltip: { mode: 'index', intersect: false } }
            }
        });

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

window.onload = displayLedger;
