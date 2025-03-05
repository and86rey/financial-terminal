let priceChart, varChart, volatilityChart;
const FMP_API_KEY = 'WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI'; // Replace with your key
let requestLedger = JSON.parse(localStorage.getItem('requestLedger')) || [];
let fullDates = [], fullPrices = [], fullVaR = [], fullVolatility = [];
let currentDays = 30;

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

function updateCharts() {
    if (!fullDates.length) {
        console.warn('No data to chart');
        return;
    }

    const dataLength = fullDates.length;
    const startIndex = Math.max(0, dataLength - currentDays);

    const visibleDates = fullDates.slice(startIndex);
    const visiblePrices = fullPrices.slice(startIndex);
    const visibleVaR = fullVaR.slice(startIndex);
    const visibleVolatility = fullVolatility.slice(startIndex);

    const tickInterval = Math.max(1, Math.floor(currentDays / 10));
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
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 12, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 14 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => `$${value.toFixed(2)}` },
                    title: { display: true, text: 'Price ($)', color: '#fff', font: { size: 14 } },
                    suggestedMin: Math.min(...visiblePrices) * 0.95,
                    suggestedMax: Math.max(...visiblePrices) * 1.05
                }
            },
            responsive: true,
            maintainAspectRatio: true,
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
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 12, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 14 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => `$${value.toFixed(2)}` },
                    title: { display: true, text: 'VaR ($)', color: '#fff', font: { size: 14 } },
                    suggestedMin: Math.min(...visibleVaR) * 0.95,
                    suggestedMax: Math.max(...visibleVaR) * 1.05
                }
            },
            responsive: true,
            maintainAspectRatio: true,
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
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        callback: (value, index) => ticks[index] || '',
                        color: '#fff',
                        font: { size: 12, family: 'Arial' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    title: { display: true, text: 'Date', color: '#fff', font: { size: 14 } }
                },
                y: {
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => value.toFixed(4) },
                    title: { display: true, text: 'Volatility', color: '#fff', font: { size: 14 } },
                    suggestedMin: Math.min(...visibleVolatility) * 0.95,
                    suggestedMax: Math.max(...visibleVolatility) * 1.05
                }
            },
            responsive: true,
            maintainAspectRatio: true,
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

    console.log('Fetching data for:', query);

    try {
        updateLedger(query);

        // Pass tickers to Python
        const [rollingVaR, rollingVolatility] = await window.processMetrics(query);
        const firstTicker = query.split(',')[0].trim();
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${firstTicker}?serietype=line&apikey=${FMP_API_KEY}`;
        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${firstTicker}?apikey=${FMP_API_KEY}`;

        const [profileRes, historicalRes] = await Promise.all([
            fetch(profileUrl).then(res => {
                if (!res.ok) throw new Error(`Profile API failed: ${res.status}`);
                return res.json();
            }),
            fetch
