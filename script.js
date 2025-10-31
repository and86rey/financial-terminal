// ==== CONFIG ====
const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const PRICE_API_URL = "https://financial-terminal.onrender.com/fetch_prices";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI";
let portfolio = [];

// ==== DOM ELEMENTS ====
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");
const portfolioTable = document.getElementById("portfolioTable");
const calculateVarBtn = document.getElementById("calculateVar");
const varResult = document.getElementById("varResult");
const priceData = document.getElementById("priceData");

// ==== EVENT LISTENERS ====
searchButton.addEventListener("click", fetchSecurity);
calculateVarBtn.addEventListener("click", calculatePortfolioVar);

// ==== ISIN → TICKER via OpenFIGI (Free) ====
async function isinToTicker(isin) {
    try {
        const response = await fetch("https://api.openfigi.com/v3/mapping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([
                { idType: "ID_ISIN", idValue: isin }
            ])
        });

        if (!response.ok) return null;
        const data = await response.json();

        // Return first valid ticker
        return data[0]?.data?.[0]?.ticker || null;
    } catch (err) {
        console.error("OpenFIGI error:", err);
        return null;
    }
}

// ==== MAIN: Search Security (Supports Ticker, Name, ISIN) ====
async function fetchSecurity() {
    let query = searchInput.value.trim();
    if (!query) return;

    searchResults.innerHTML = "<p>Searching...</p>";

    let symbol = query.toUpperCase();

    // --- Detect ISIN (12 chars, e.g., US0378331005) ---
    const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
    if (isinRegex.test(query)) {
        searchResults.innerHTML = "<p>Resolving ISIN via OpenFIGI...</p>";
        const ticker = await isinToTicker(query);
        if (!ticker) {
            searchResults.innerHTML = "<p>ISIN not found in OpenFIGI database.</p>";
            return;
        }
        symbol = ticker;
        searchResults.innerHTML = `<p>ISIN resolved → <b>${ticker}</b></p>`;
    }

    // --- Fetch security profile from FMP ---
    const url = `https://financialmodelingprep.com/api/v4/profile/${symbol}?apikey=${FMP_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || data.length === 0) {
            searchResults.innerHTML = "<p>No results found for this symbol.</p>";
            return;
        }

        displaySearchResult(data[0]);
    } catch (err) {
        console.error("FMP API error:", err);
        searchResults.innerHTML = "<p>Error fetching data. Check console.</p>";
    }
}

// ==== DISPLAY SEARCH RESULT ====
function displaySearchResult(stock) {
    searchResults.innerHTML = `
        <div style="padding: 10px; background: #1a1a1a; border-radius: 5px;">
            <strong>${stock.companyName}</strong> 
            (<span style="color: #f5a623;">${stock.symbol}</span>) 
            — Price: <b>$${parseFloat(stock.price).toFixed(2)}</b>
            <br><br>
            <input type="number" id="weightInput" placeholder="Weight %" min="0.1" max="100" step="0.1" style="width: 80px;">
            <button onclick="addToPortfolio('${stock.symbol}', '${stock.companyName.replace(/'/g, "\\'")}')" 
                    style="margin-left: 8px;">Add</button>
        </div>
    `;
}

// ==== PORTFOLIO MANAGEMENT ====
function addToPortfolio(symbol, name) {
    if (portfolio.length >= 5) {
        alert("Maximum 5 securities allowed.");
        return;
    }

    const weightInput = document.getElementById("weightInput");
    const weight = parseFloat(weightInput.value);
    if (isNaN(weight) || weight <= 0 || weight > 100) {
        alert("Enter a valid weight (0.1–100%).");
        return;
    }

    // Avoid duplicates
    if (portfolio.some(s => s.symbol === symbol)) {
        alert("This security is already in the portfolio.");
        return;
    }

    portfolio.push({ symbol, name, weight });
    updatePortfolioTable();
    searchResults.innerHTML = "";
    searchInput.value = "";
}

function removeFromPortfolio(index) {
    portfolio.splice(index, 1);
    updatePortfolioTable();
    varResult.innerHTML = "<p>Portfolio updated. Recalculate VaR.</p>";
}

function updatePortfolioTable() {
    portfolioTable.innerHTML = "";
    const totalWeight = portfolio.reduce((sum, s) => sum + s.weight, 0);

    portfolio.forEach((stock, i) => {
        const row = portfolioTable.insertRow();
        row.innerHTML = `
            <td>${stock.name} (${stock.symbol})</td>
            <td>${stock.weight.toFixed(1)}% ${totalWeight > 100 ? '<span style="color:#ff6b6b;">(Over 100%)</span>' : ''}</td>
            <td><button onclick="removeFromPortfolio(${i})" style="background:#ff4444;">Remove</button></td>
        `;
    });

    if (totalWeight > 100) {
        portfolioTable.insertRow().innerHTML = `<td colspan="3" style="color:#ff6b6b; font-weight:bold;">Total weight exceeds 100%</td>`;
    }
}

// ==== CALCULATE PORTFOLIO VaR ====
async function calculatePortfolioVar() {
    if (portfolio.length === 0) {
        varResult.innerHTML = "<p>No securities in portfolio.</p>";
        return;
    }

    const symbols = portfolio.map(s => s.symbol);
    const weights = portfolio.map(s => s.weight);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols, weights })
        });

        if (!response.ok) throw new Error("API error");

        const result = await response.json();
        displayVarResults(result);
    } catch (err) {
        console.error(err);
        varResult.innerHTML = "<p>Error calculating VaR. Check backend logs.</p>";
    }
}

function displayVarResults(varData) {
    let html = `
        <h2>Portfolio VaR Results</h2>
        <table border="1" style="width:100%; margin-top:10px;">
            <tr>
                <th>Security</th>
                <th>VaR 1D 95%</th>
                <th>VaR 1D 99%</th>
            </tr>
    `;

    for (const [symbol, values] of Object.entries(varData)) {
        if (symbol === "Portfolio") continue;
        html += `
            <tr>
                <td>${symbol}</td>
                <td>${values.VaR_1d_95 !== undefined ? (values.VaR_1d_95 * 100).toFixed(3) + '%' : 'N/A'}</td>
                <td>${values.VaR_1d_99 !== undefined ? (values.VaR_1d_99 * 100).toFixed(3) + '%' : 'N/A'}</td>
            </tr>
        `;
    }

    // Portfolio row
    if (varData.Portfolio) {
        html += `
            <tr style="background:#333; font-weight:bold;">
                <td>Portfolio</td>
                <td>${(varData.Portfolio.VaR_1d_95 * 100).toFixed(3)}%</td>
                <td>${(varData.Portfolio.VaR_1d_99 * 100).toFixed(3)}%</td>
            </tr>
        `;
    }

    html += `</table>`;
    varResult.innerHTML = html;
}

// ==== FETCH HISTORICAL PRICES ====
async function fetchPortfolioPrices() {
    if (portfolio.length === 0) {
        priceData.innerHTML = "<p>No securities in portfolio.</p>";
        return;
    }

    const symbols = portfolio.map(s => s.symbol);

    try {
        const response = await fetch(PRICE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols })
        });

        if (!response.ok) throw new Error("Price API failed");

        const result = await response.json();
        if (!result.prices || Object.keys(result.prices).length === 0) {
            throw new Error("No price data");
        }

        const dates = new Set();
        symbols.forEach(sym => {
            if (result.prices[sym]) {
                Object.keys(result.prices[sym]).forEach(d => dates.add(d));
            }
        });

        let table = `<table border="1"><tr><th>Date</th>`;
        symbols.forEach(sym => table += `<th>${sym}</th>`);
        table += `</tr>`;

        [...dates].sort().reverse().slice(0, 100).forEach(date => {  // Limit to recent 100
            table += `<tr><td>${date}</td>`;
            symbols.forEach(sym => {
                const p = result.prices[sym]?.[date];
                table += `<td>${p ? p.toFixed(2) : "—"}</td>`;
            });
            table += `</tr>`;
        });

        table += `</table>`;
        priceData.innerHTML = table;
    } catch (err) {
        console.error(err);
        priceData.innerHTML = "<p>Error loading prices.</p>";
    }
}
