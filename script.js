const API_URL = "https://financial-terminal.onrender.com/calculate_var";
const FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"; // ✅ Correct API Key
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
        
        if (!result.VaR_Table || result.VaR_Table.length === 0) {
            document.getElementById("varResult").innerText = "Error: No VaR data received.";
            return;
        }

        // ✅ Extract Portfolio VaR & Individual Security VaR
        let portfolioVar = result.VaR_Table.find(row => row.horizon === "1 day(s)" && row.confidence_level === "95%")?.VaR || 0;
        let securityVars = result.security_VaRs || []; // API should return individual VaRs

        // ✅ Maintain ticker order and append portfolio at the end
        const labels = [...symbols, "Portfolio"];
        const data = [...securityVars, portfolioVar];

        // ✅ Generate Table First
        let tableHtml = `<table border="1">
            <tr><th>Security</th><th>VaR (%)</th></tr>`;
        
        labels.forEach((label, index) => {
            tableHtml += `<tr><td>${label}</td><td>${data[index]}</td></tr>`;
        });

        tableHtml += `</table>`;
        document.getElementById("varResult").innerHTML = tableHtml;

        // ✅ Then Update Graph
        updateVarChart(labels, data);

    } catch (error) {
        console.error("Error calculating Portfolio VaR:", error);
        document.getElementById("varResult").innerText = "Error calculating Portfolio VaR.";
    }
}

// ✅ Function to Update Horizontal Bar Chart
function updateVarChart(labels, data) {
    const ctx = document.getElementById("varChart").getContext("2d");

    // Destroy previous chart instance if it exists
    if (window.varChartInstance) {
        window.varChartInstance.destroy();
    }

    window.varChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels, // Securities + "Portfolio" at the end
            datasets: [{
                label: "VaR (%)",
                data: data,
                backgroundColor: labels.map((_, index) => index === labels.length - 1 ? "#ff5733" : "#3399ff"),
                borderColor: "#ffffff",
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: "y", // ✅ Makes the bars horizontal
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: "Value at Risk (%)" }
                },
                y: {
                    title: { display: true, text: "Securities & Portfolio" }
                }
            }
        }
    });
}
