const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"; 
let portfolio = [];

// ✅ Load Chart.js dynamically
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(script);

document.getElementById("searchButton").addEventListener("click", fetchSecurity);
document.getElementById("calculateVar").addEventListener("click", calculatePortfolioVar);

async function fetchSecurity() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return;

    const url = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const data = await response.json();

        if (data.length) {
            displaySearchResult(data[0]);
        } else {
            document.getElementById("searchResults").innerHTML = `<p>No results found.</p>`;
        }
    } catch (error) {
        console.error("Error fetching security:", error);
        document.getElementById("searchResults").innerHTML = `<p>Error fetching security.</p>`;
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
        alert("This is a demo version. Maximum 5 securities allowed.");
        return;
    }

    const weight = parseFloat(document.getElementById("weightInput").value);
    if (isNaN(weight) || weight <= 0 || weight > 100) return;

    portfolio.push({ symbol, name, weight });
    updatePortfolioTable();
}

async function calculatePortfolioVar() {
    if (portfolio.length === 0) {
        document.getElementById("varResult").innerText = "Portfolio is empty. Add stocks first.";
        return;
    }

    const symbols = portfolio.map(stock => stock.symbol);
    const weights = portfolio.map(stock => stock.weight / 100);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols, weights })
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

        const result = await response.json();

        if (!result.VaR_Table) {
            document.getElementById("varResult").innerText = "Error: No valid VaR data available.";
            return;
        }

        let tableHtml = `<table border="1">
            <tr><th>Security</th><th>VaR 1-Day (95%)</th><th>VaR 1-Day (99%)</th><th>VaR 1-Month (95%)</th><th>VaR 1-Month (99%)</th></tr>`;

        result.VaR_Table.forEach(row => {
            tableHtml += `<tr><td>${row.security || "Portfolio"}</td><td>${row["VaR 1-Day (95%)"] || "-"}</td><td>${row["VaR 1-Day (99%)"] || "-"}</td><td>${row["VaR 1-Month (95%)"] || "-"}</td><td>${row["VaR 1-Month (99%)"] || "-"}</td></tr>`;
        });

        tableHtml += `</table>`;
        document.getElementById("varResult").innerHTML = tableHtml;

    } catch (error) {
        document.getElementById("varResult").innerText = "Error calculating Portfolio VaR.";
    }
}
