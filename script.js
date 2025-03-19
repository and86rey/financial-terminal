let portfolio = [];

document.getElementById("searchButton").addEventListener("click", function () {
    const query = document.getElementById("searchInput").value;
    fetch(`https://financialmodelingprep.com/api/v3/search?query=${query}&apikey=your_fmp_api_key`)
        .then(response => response.json())
        .then(data => {
            let resultsDiv = document.getElementById("searchResults");
            resultsDiv.innerHTML = "";
            data.forEach(company => {
                let button = document.createElement("button");
                button.textContent = `${company.name} (${company.symbol})`;
                button.onclick = () => addToPortfolio(company.symbol, company.name);
                resultsDiv.appendChild(button);
            });
        })
        .catch(error => console.error("Error searching for stock:", error));
});

function addToPortfolio(symbol, name) {
    if (portfolio.length >= 5) {
        alert("This is a demo version. The limit is 5 securities.");
        return;
    }

    let weight = prompt(`Enter weight (%) for ${name}:`);
    weight = parseFloat(weight);
    if (isNaN(weight) || weight <= 0) {
        alert("Invalid weight. Please enter a positive number.");
        return;
    }

    portfolio.push({ symbol, name, weight });
    updatePortfolioTable();
}

function updatePortfolioTable() {
    let tableBody = document.getElementById("portfolioTable");
    tableBody.innerHTML = "";
    portfolio.forEach((stock, index) => {
        let row = `<tr>
            <td>${stock.name} (${stock.symbol})</td>
            <td>${stock.weight}%</td>
            <td><button onclick="removeFromPortfolio(${index})">Remove</button></td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function removeFromPortfolio(index) {
    portfolio.splice(index, 1);
    updatePortfolioTable();
}

document.getElementById("calculateVar").addEventListener("click", function () {
    fetch("https://your-api-url.com/calculate_var", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            symbols: portfolio.map(item => item.symbol),
            weights: portfolio.map(item => item.weight)
        })
    })
    .then(response => response.json())
    .then(data => {
        const headerRow = document.getElementById("varHeaderRow");
        const body = document.getElementById("varResultsBody");

        headerRow.innerHTML = "<th>VaR Type</th>";
        body.innerHTML = "";

        let varTypes = ["Normal_VaR_1D_95", "Normal_VaR_1D_99", "Hist_VaR_1D_95", "Hist_VaR_1D_99", 
                        "MonteCarlo_VaR_1D_95", "MonteCarlo_VaR_1D_99", "CornishFisher_VaR_1D_95", "CornishFisher_VaR_1D_99"];

        let securities = Object.keys(data);
        securities.forEach(security => {
            headerRow.innerHTML += `<th>${security}</th>`;
        });

        varTypes.forEach(varType => {
            let row = document.createElement("tr");
            row.innerHTML = `<td>${varType.replace(/_/g, " ")}</td>`;
            securities.forEach(security => {
                row.innerHTML += `<td>${data[security][varType] ?? "N/A"}</td>`;
            });
            body.appendChild(row);
        });

        fetchPriceData();
    })
    .catch(error => console.error("Error fetching VaR data:", error));
});

function fetchPriceData() {
    let tableHeader = document.getElementById("priceHeaderRow");
    let tableBody = document.getElementById("priceDataBody");

    tableHeader.innerHTML = "<th>Date</th>";
    tableBody.innerHTML = "";

    let promises = portfolio.map(stock => {
        return fetch(`https://financialmodelingprep.com/api/v3/historical-price-full/${stock.symbol}?apikey=your_fmp_api_key`)
            .then(response => response.json())
            .then(data => {
                if (data.historical) {
                    return { symbol: stock.symbol, prices: data.historical.slice(0, 10) };
                } else {
                    return { symbol: stock.symbol, prices: [] };
                }
            });
    });

    Promise.all(promises).then(results => {
        let dates = new Set();
        results.forEach(stockData => {
            stockData.prices.forEach(price => dates.add(price.date));
        });

        let sortedDates = Array.from(dates).sort().reverse();
        sortedDates.forEach(date => {
            let row = document.createElement("tr");
            row.innerHTML = `<td>${date}</td>`;

            results.forEach(stockData => {
                let priceObj = stockData.prices.find(p => p.date === date);
                row.innerHTML += `<td>${priceObj ? priceObj.close.toFixed(2) : "N/A"}</td>`;
            });

            tableBody.appendChild(row);
        });

        results.forEach(stockData => {
            tableHeader.innerHTML += `<th>${stockData.symbol}</th>`;
        });
    });
}
