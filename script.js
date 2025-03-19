const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const PRICE_API_URL = "https://financial-terminal.onrender.com/fetch_prices";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI";

let portfolio = [];

document.addEventListener("DOMContentLoaded", function () {
    const searchButton = document.getElementById("searchButton");
    const calculateVarButton = document.getElementById("calculateVar");
    
    if (searchButton) searchButton.addEventListener("click", fetchSecurity);
    if (calculateVarButton) calculateVarButton.addEventListener("click", calculatePortfolioVar);
});

async function fetchSecurity() {
    const query = document.getElementById("searchInput")?.value.trim();
    if (!query) return;

    const url = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            const searchResults = document.getElementById("searchResults");
            if (searchResults) searchResults.innerHTML = "<p>No results found.</p>";
            return;
        }

        displaySearchResult(data[0]);
    } catch {
        const searchResults = document.getElementById("searchResults");
        if (searchResults) searchResults.innerHTML = "<p>Error fetching security.</p>";
    }
}

function displaySearchResult(stock) {
    const searchResults = document.getElementById("searchResults");
    if (searchResults) {
        searchResults.innerHTML = `
            <p>${stock.companyName} (${stock.symbol}) - Price: $${stock.price}</p>
            <input type="number" id="weightInput" placeholder="Enter weight %" min="1" max="100">
            <button onclick="addToPortfolio('${stock.symbol}', '${stock.companyName}')">Add to Portfolio</button>
        `;
    }
}

function addToPortfolio(symbol, name) {
    if (portfolio.length >= 5) {
        alert("Maximum 5 securities allowed.");
        return;
    }

    const weightInput = document.getElementById("weightInput");
    if (!weightInput) return;
    
    const weight = parseFloat(weightInput.value);
    if (isNaN(weight) || weight <= 0 || weight > 100) return;

    portfolio.push({ symbol, name, weight });
    updatePortfolioTable();
}

function removeFromPortfolio(index) {
    portfolio.splice(index, 1);
    updatePortfolioTable();
    const varResult = document.getElementById("varResultsBody");
    if (varResult) varResult.innerText = "Portfolio updated. Recalculate VaR.";
}

function updatePortfolioTable() {
    const table = document.getElementById("portfolioTable");
    if (!table) return;
    
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
    const varResult = document.getElementById("varResultsBody");
    if (!varResult) return;
    
    if (portfolio.length === 0) {
        varResult.innerText = "No securities in portfolio.";
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
        varResult.innerText = "Error calculating VaR.";
        console.error("Error fetching VaR data:", error);
    }
}

function displayVarResults(varData) {
    const varResult = document.getElementById("varResultsBody");
    if (!varResult) return;
    
    let tableHtml = "";
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

    varResult.innerHTML = tableHtml;
}
