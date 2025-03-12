const API_URL = "https://your-backend-url.com/calculate_var";
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

function updatePortfolioTable() {
    const table = document.getElementById("portfolioTable");
    table.innerHTML = portfolio.map((stock, index) => `
        <tr>
            <td>${stock.name} (${stock.symbol})</td>
            <td>${stock.weight}%</td>
            <td><button onclick="removeFromPortfolio(${index})">Remove</button></td>
        </tr>
    `).join("");
}

async function calculatePortfolioVar() {
    if (portfolio.length === 0) {
        document.getElementById("varResult").innerText = "Portfolio is empty.";
        return;
    }

    const symbols = portfolio.map(stock => stock.symbol);
    const weights = portfolio.map(stock => stock.weight / 100);

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, weights })
    });

    const result = await response.json();
    document.getElementById("varResult").innerText = `Portfolio VaR: ${result.portfolio_var}`;
}


const FMP_API_KEY = '';
let portfolio = [];

document.getElementById('searchButton').addEventListener('click', fetchSecurity);
document.getElementById('calculateVar').addEventListener('click', calculatePortfolioVar);

async function fetchSecurity() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const url = `https://financialmodelingprep.com/api/v3/profile/${query}?apikey=${FMP_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const data = await response.json();

        if (data.length) {
            displaySearchResult(data[0]);
        } else {
            document.getElementById('searchResults').innerHTML = `<p>No results found.</p>`;
        }
    } catch (error) {
        console.error("Error fetching security:", error);
        document.getElementById('searchResults').innerHTML = `<p>Error fetching security.</p>`;
    }
}

function displaySearchResult(stock) {
    document.getElementById('searchResults').innerHTML = `
        <p>${stock.companyName} (${stock.symbol}) - Price: $${stock.price}</p>
        <input type="number" id="weightInput" placeholder="Enter weight %" min="1" max="100">
        <button onclick="addToPortfolio('${stock.symbol}', '${stock.companyName}')">Add to Portfolio</button>
    `;
}
