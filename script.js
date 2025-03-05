let priceChart, varChart, volatilityChart;
const FMP_API_KEY = 'WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI'; // Replace with your key
let requestLedger = JSON.parse(localStorage.getItem('requestLedger')) || [];
let fullDates = [], fullPrices = [], fullVaR = [], fullVolatility = [];
let shortMA = [], longMA = [];
let currentDays = 30;

async function waitForPyScript() {
    return new Promise((resolve) => {
        if (window.processMetrics) {
            resolve();
        } else {
            document.addEventListener('pyscript-ready', resolve, { once: true });
        }
    });
}

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

function normalizeData(data) {
    const min = Math.min(...data.filter(v => v !== 0));
    const max = Math.max(...data.filter(v => v !== 0));
    return data.map(v => v === 0 ? 0 : (v - min) / (max - min)); // Relative 0-1 scale
}

function updateCharts() {
    console.log('Updating charts...');
    console.log('fullDates:', fullDates);
    console.log('fullPrices:', fullPrices);
    console.log('fullVaR:', fullVaR);
    console.log('fullVolatility:', fullVolatility);
    console.log('shortMA:', shortMA);
    console.log('longMA:', longMA);

    if (!fullDates.length || !fullPrices.length || !fullVaR.length || !fullVolatility.length) {
        console.warn('Missing data for charts');
        return;
    }

    const dataLength = fullDates.length;
    const startIndex = Math.max(0, dataLength - currentDays);

    const visibleDates = fullDates.slice(startIndex);
    const visiblePrices = fullPrices.slice(startIndex);
    const visibleVaR = fullVaR.slice(startIndex);
    const visibleVolatility = fullVolatility.slice(startIndex);
    const visibleShortMA = shortMA.slice(startIndex);
    const visibleLongMA = longMA.slice(startIndex);

    const tickInterval = Math.max(1, Math.floor(currentDays / 10));
    const ticks = visibleDates.filter((_, i) => i % tickInterval === 0);

    const normPrices = normalizeData(visiblePrices);
    const normVaR = normalizeData(visibleVaR);
    const normVolatility = normalizeData(visibleVolatility);
    const normShortMA = normalizeData(visibleShortMA);
    const normLongMA = normalizeData(visibleLongMA);

    if (priceChart) priceChart.destroy();
    if (varChart) varChart.destroy();
    if (volatilityChart) volatilityChart.destroy();

    priceChart = new Chart(document.getElementById('priceChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: visibleDates,
            datasets: [
                {
                    label: 'Price',
                    data: normPrices,
                    borderColor: '#fff',
                    fill: false,
                    pointRadius: 2,
                    borderWidth: 2
                },
                {
                    label: '20-day MA',
                    data: normShortMA,
                    borderColor: '#f5a623',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1,
                    borderDash: [5, 5]
                },
                {
                    label: '50-day MA',
                    data: normLongMA,
                    borderColor: '#00cc00',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1,
                    borderDash: [5, 5]
                }
            ]
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
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => `${(value * 100).toFixed(0)}%` },
                    title: { display: true, text: 'Relative Price', color: '#fff', font: { size: 14 } },
                    min: 0,
                    max: 1
                }
            },
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, labels: { color: '#fff', font: { size: 12 } } },
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
                data: normVaR,
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
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => `${(value * 100).toFixed(0)}%` },
                    title: { display: true, text: 'Relative VaR', color: '#fff', font: { size: 14 } },
                    min: 0,
                    max: 1
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
                data: normVolatility,
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
                    ticks: { color: '#fff', font: { size: 12 }, callback: value => `${(value * 100).toFixed(0)}%` },
                    title: { display: true, text: 'Relative Volatility', color: '#fff', font: { size: 14 } },
                    min: 0,
                    max: 1
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

        const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
        const historicalUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${query}?serietype=line&apikey=${FMP_API_KEY}`;

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

        await waitForPyScript();
        if (!window.processMetrics) {
            throw new Error('processMetrics not available after PyScript load');
        }
        const [rollingVaR, rollingVolatility, shortMAData, longMAData] = await window.processMetrics(fullPrices);
        fullVaR = rollingVaR;
        fullVolatility = rollingVolatility;
        shortMA = shortMAData;
        longMA = longMAData;

        console.log('Post-Python data:', { fullVaR, fullVolatility, shortMA, longMA });

        currentDays = 30;
        document.getElementById('dayRange').value = currentDays;
        document.getElementById('dayCount').textContent = `${currentDays} days`;
        updateCharts();

    } catch (error) {
        console.error('Fetch error:', error.message);
        document.getElementById('financialData').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

function updateDays(days) {
    currentDays = parseInt(days);
    document.getElementById('dayCount').textContent = `${currentDays} days`;
    updateCharts();
}

function setDays(days) {
    currentDays = days;
    document.getElementById('dayRange').value = currentDays;
    document.getElementById('dayCount').textContent = `${currentDays} days`;
    updateCharts();
}

window.onload = () => {
    console.log('Page loaded');
    displayLedger();
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            console.log('Search button clicked');
            fetchData();
        });
    } else {
        console.error('Search button not found');
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter key pressed');
                fetchData();
            }
        });
    } else {
        console.error('Search input not found');
    }
};
