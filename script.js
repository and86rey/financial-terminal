let priceChart, varChart, volatilityChart;
const FMP_API_KEY = 'WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI'; // Replace with your actual FMP API key
let requestLedger = JSON.parse(localStorage.getItem('requestLedger')) || [];
let fullDates = [], fullPrices = [], fullVaR = [], fullVolatility = [];
let currentView = 'full';

function updateLedger(query) {
    const timestamp = new Date().toISOString();
    requestLedger.push({ query, timestamp });
    localStorage.setItem('requestLedger', JSON.stringify(requestLedger));
    displayLedger();
}

function displayLedger() {
    const ledgerList = document.getElementById('ledgerList');
    if (ledgerList) {
        ledgerList.innerHTML = requestLedger.map(r => `<li>${r.query} - ${r.timestamp}</li>`).join('');
    } else {
        console.error('Ledger list element not found');
    }
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
    if (!fullDates.length) {
        console.warn('No data to chart');
        return;
    }

    const dataLength = fullDates.length;
    const visibleDays = currentView === 'full' ? 252 : 21;
    const startIndex = Math.max(0, dataLength - visibleDays);

    const visibleDates = fullDates.slice(startIndex);
    const visiblePrices = fullPrices.slice(startIndex);
    const visibleVaR = fullVaR.slice(startIndex);
    const visibleVolatility = fullVolatility.slice(startIndex);

    const tickInterval = currentView === 'full' ? 25 : 2;
    const ticks = visibleDates.filter((_, i) => i % tickInterval === 0);

    if (priceChart) priceChart.destroy();
    if (varChart) varChart.destroy();
    if (volatilityChart) volatilityChart.destroy();

    priceChart = new Chart(document.getElementById('priceChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [{
                label: 'Price',
                data: visiblePrices,
                borderColor: '#fff',
                fill: false,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 14, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 16 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 14 }, callback: value => `$${value.toFixed(2)}` },
                    title: { display: true, text: 'Price ($)', color: '#fff', font: { size: 16 } }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });

    varChart = new Chart(document.getElementById('varChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [{
                label: 'VaR',
                data: visibleVaR,
                borderColor: '#f5a623',
                fill: false,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 14, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 16 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 14 }, callback: value => `$${value.toFixed(2)}` },
                    title: { display: true, text: 'VaR ($)', color: '#fff', font: { size: 16 } }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });

    volatilityChart = new Chart(document.getElementById('volatilityChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [{
                label: 'Volatility',
                data: visibleVolatility,
                borderColor: '#00cc00',
                fill: false,
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 14, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 16 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 14 }, callback: value => value.toFixed(4) },
                    title: { display: true, text: 'Volatility', color: '#fff', font: { size: 16 } }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

async function fetchData() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        console.log('No query entered');
        return;
    }

    console.log('Fetching data for:', query); // Debug

    try {
        updateLedger(query);

        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line&apikey=${FMP_API_KEY}`;

        console.log('Profile URL:', profileUrl); // Debug
        console.log('Historical URL:', historicalUrl); // Debug

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => {
                if (!res.ok) throw new Error(`Profile API failed: ${res.status}`);
                return res.json();
            }),
            fetch(historicalUrl).then(res => {
                if (!res.ok) throw new Error(`Historical API failed: ${res.status}`);
                return res.json();
            })
        ]);

        console.log('Profile Response:', profileRes); // Debug
        console.log('Historical Response:', historicalRes); // Debug

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

        console.log('Dates:', fullDates); // Debug
        console.log('Prices:', fullPrices); // Debug
        console.log('VaR:', fullVaR); // Debug
        console.log('Volatility:', fullVolatility); // Debug

        currentView = 'full';
        updateCharts();

    } catch (error) {
        console.error('Fetch error:', error.message);
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function showLastMonth() {
    currentView = 'month';
    updateCharts();
}

function showFullYear() {
    currentView = 'full';
    updateCharts();
}

window.onload = () => {
    console.log('Page loaded'); // Debug
    displayLedger();
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            console.log('Search button clicked'); // Debug
            fetchData();
        });
    } else {
        console.error('Search button not found');
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter key pressed'); // Debug
                fetchData();
            }
        });
    } else {
        console.error('Search input not found');
    }
};
