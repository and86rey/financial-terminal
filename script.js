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

function showTab(tabName) {
    document.getElementById("varResultsBody").innerHTML = "<tr><td>Loading...</td></tr>";
    calculatePortfolioVar(tabName);
}

async function fetchSecurity() {
    const query = document.getElementById("searchInput")?.value.trim();
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
    document.getElementById("varResultsBody").innerText = "Portfolio updated. Recalculate VaR.";
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

async function calculatePortfolioVar(activeTab) {
    if (portfolio.length === 0) {
        document.getElementById("varResultsBody").innerText = "No securities in portfolio.";
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
        displayVarResults(result, activeTab);
    } catch (error) {
        document.getElementById("varResultsBody").innerText = "Error calculating VaR.";
        console.error("Error fetching VaR data:", error);
    }
}

function displayVarResults(varData, activeTab) {
    const varResult = document.getElementById("varResultsBody");
    varResult.innerHTML = "";
    
    let tableHtml = "<tr><th>VaR Type</th>";
    for (const symbol of Object.keys(varData)) {
        tableHtml += `<th>${symbol}</th>`;
    }
    tableHtml += "</tr>";

    const varCategories = {
        normal: ["Normal_VaR_1D_95", "Normal_VaR_1D_99", "Normal_VaR_42D_95", "Normal_VaR_42D_99"],
        historical: ["Hist_VaR_1D_95", "Hist_VaR_1D_99", "Hist_VaR_42D_95", "Hist_VaR_42D_99"],
        montecarlo: ["MonteCarlo_VaR_1D_95", "MonteCarlo_VaR_1D_99", "MonteCarlo_VaR_42D_95", "MonteCarlo_VaR_42D_99"],
        cornish: ["CornishFisher_VaR_1D_95", "CornishFisher_VaR_1D_99", "CornishFisher_VaR_42D_95", "CornishFisher_VaR_42D_99"]
    };

    const varTypes = varCategories[activeTab] || [];
    for (const varType of varTypes) {
        tableHtml += `<tr><td>${varType.replace(/_/g, ' ')}</td>`;
        for (const symbol of Object.keys(varData)) {
            tableHtml += `<td>${varData[symbol][varType] || "N/A"}</td>`;
        }
        tableHtml += "</tr>";
    }

    varResult.innerHTML = tableHtml;
}
