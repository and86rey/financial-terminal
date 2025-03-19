const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const PRICE_API_URL = "https://financial-terminal.onrender.com/fetch_prices";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"; 

let portfolio = [];

document.getElementById("searchButton").addEventListener("click", fetchSecurity);
document.getElementById("calculateVar").addEventListener("click", calculatePortfolioVar);

async function fetchSecurity() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return;

    const url = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            document.getElementById("searchResults").innerHTML = "<p>No results found.</p>";
            return;
        }

        displaySearchResult(data[0]);
    } catch {
        document.getElementById("searchResults").innerHTML = "<p>Error fetching security.</p>";
    }
}

function displaySearchResult(stock) {
    document.getElementById("searchResults").innerHTML = `
        <p>${stock.companyName} (${stock.symbol}) - Price: $${stock.price}</p>
        <input type="number" id="weightInput" placeholder="Enter weight %" min="1" max="100">
        <button onclick="addToPortfolio('${stock.symbol}', '${stock.companyName}')">Add to Portfolio</button>
    `;
}

function addToPortfolio(symbol, name) {
    if (portfolio.length >= 5) {
        alert("Maximum 5 securities allowed.");
        return;
    }

    const weight = parseFloat(document.getElementById("weightInput").value);
    if (isNaN(weight) || weight <= 0 || weight > 100) return;

    portfolio.push({ symbol, name, weight });
    updatePortfolioTable();
}

function removeFromPortfolio(index) {
    portfolio.splice(index, 1);
    updatePortfolioTable();
    document.getElementById("varResult").innerText = "Portfolio updated. Recalculate VaR.";
}

function updatePortfolioTable() {
    const table = document.getElementById("portfolioTable");
    table.innerHTML = "";

    portfolio.forEach((stock, index) => {
        let row = table.insertRow();
        row.innerHTML = `
            <td>${stock.name} (${stock.symbol})</td>
            <td>${stock.weight}%</td>
            <td><button onclick="removeFromPortfolio(${index})">Remove</button></td>
        `;
    });
}

async function calculatePortfolioVar() {
    if (portfolio.length === 0) {
        document.getElementById("varResult").innerText = "No securities in portfolio.";
        return;
    }

    const symbols = portfolio.map(stock => stock.symbol);
    const weights = portfolio.map(stock => stock.weight);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols, weights })
        });

        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const result = await response.json();
        displayVarResults(result);
    } catch (error) {
        document.getElementById("varResult").innerText = "Error calculating VaR.";
        console.error("Error fetching VaR data:", error);
    }
}

function displayVarResults(varData) {
    let tableHtml = "<h2>Portfolio VaR Results</h2>";
    tableHtml += `<table border="1">
                    <tr>
                        <th>Security</th>
                        <th>VaR 1D 95%</th>
                        <th>VaR 1D 99%</th>
                        <th>Hist. VaR 1D 95%</th>
                        <th>Hist. VaR 1D 99%</th>
                        <th>Monte Carlo 1D 95%</th>
                        <th>Monte Carlo 1D 99%</th>
                        <th>Cornish-Fisher 1D 95%</th>
                        <th>Cornish-Fisher 1D 99%</th>
                    </tr>`;

    for (const [symbol, varValues] of Object.entries(varData)) {
        tableHtml += `<tr>
                        <td>${symbol}</td>
                        <td>${varValues.Normal_VaR_1D_95 || "N/A"}</td>
                        <td>${varValues.Normal_VaR_1D_99 || "N/A"}</td>
                        <td>${varValues.Hist_VaR_1D_95 || "N/A"}</td>
                        <td>${varValues.Hist_VaR_1D_99 || "N/A"}</td>
                        <td>${varValues.MonteCarlo_VaR_1D_95 || "N/A"}</td>
                        <td>${varValues.MonteCarlo_VaR_1D_99 || "N/A"}</td>
                        <td>${varValues.CornishFisher_VaR_1D_95 || "N/A"}</td>
                        <td>${varValues.CornishFisher_VaR_1D_99 || "N/A"}</td>
                    </tr>`;
    }

    tableHtml += "</table>";
    document.getElementById("varResult").innerHTML = tableHtml;
}

// ✅ Fetches historical prices for securities in the portfolio
async function fetchPortfolioPrices() {
    if (portfolio.length === 0) {
        document.getElementById("priceData").innerText = "No securities in portfolio.";
        return;
    }

    const symbols = portfolio.map(stock => stock.symbol);

    try {
        const response = await fetch(PRICE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols }) 
        });

        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const result = await response.json();
        if (!result.prices || Object.keys(result.prices).length === 0) {
            throw new Error("No historical data available.");
        }

        let tableHtml = `<table border="1"><tr><th>Date</th>`;
        symbols.forEach(symbol => tableHtml += `<th>${symbol}</th>`);
        tableHtml += `</tr>`;

        const allDates = new Set();
        symbols.forEach(symbol => {
            if (result.prices[symbol]) {
                Object.keys(result.prices[symbol]).forEach(date => allDates.add(date));
            }
        });

        [...allDates].sort().reverse().forEach(date => {
            tableHtml += `<tr><td>${date}</td>`;
            symbols.forEach(symbol => {
                const price = result.prices[symbol]?.[date] || "N/A";
                tableHtml += `<td>${price}</td>`;
            });
            tableHtml += `</tr>`;
        });

        document.getElementById("priceData").innerHTML = tableHtml;
    } catch (error) {
        document.getElementById("priceData").innerText = "Error retrieving price data.";
        console.error("Fetch Prices Error:", error);
    }
}
