const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const OPTIMIZE_API_URL = "https://financial-terminal.onrender.com/optimize_portfolio";
const PRICE_API_URL = "https://financial-terminal.onrender.com/fetch_prices";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI";

let portfolio = [];
let comments = [];

document.addEventListener("DOMContentLoaded", function () {
    const searchButton = document.getElementById("searchButton");
    const calculateVarButton = document.getElementById("calculateVar");
    const optimizePortfolioButton = document.getElementById("optimizePortfolio");
    const submitCommentButton = document.getElementById("submitComment");
    
    if (searchButton) searchButton.addEventListener("click", fetchSecurity);
    if (calculateVarButton) calculateVarButton.addEventListener("click", () => calculatePortfolioVar());
    if (optimizePortfolioButton) optimizePortfolioButton.addEventListener("click", optimizePortfolio);
    if (submitCommentButton) submitCommentButton.addEventListener("click", submitComment);
});

function showTab(tabName) {
    document.getElementById("varResultsBody").innerHTML = "<tr><td>Loading...</td></tr>";
    calculatePortfolioVar();
}

function submitComment() {
    const commentInput = document.getElementById("commentInput");
    const commentText = commentInput.value.trim();
    if (!commentText) return;
    
    comments.push(commentText);
    updateCommentSection();
    commentInput.value = "";
}

function updateCommentSection() {
    const commentList = document.getElementById("commentList");
    commentList.innerHTML = "";
    comments.forEach(comment => {
        let commentItem = document.createElement("p");
        commentItem.textContent = comment;
        commentList.appendChild(commentItem);
    });
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

function displayVarResults(result) {
    let varResultsBody = document.getElementById("varResultsBody");
    varResultsBody.innerHTML = "";

    for (const [key, values] of Object.entries(result)) {
        let row = `<tr><td>${key}</td>`;
        row += `<td>${values.Normal_VaR_1D_95?.toFixed(4) || "N/A"}</td>`;
        row += `<td>${values.Normal_VaR_1D_99?.toFixed(4) || "N/A"}</td></tr>`;
        varResultsBody.innerHTML += row;
    }
}

async function calculatePortfolioVar() {
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
        displayVarResults(result);
    } catch (error) {
        document.getElementById("varResultsBody").innerText = "Error calculating VaR.";
        console.error("Error fetching VaR data:", error);
    }
}
