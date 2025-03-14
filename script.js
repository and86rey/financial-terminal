async function calculatePortfolioVar() {
    if (portfolio.length === 0) {
        document.getElementById("varResult").innerText = "Portfolio is empty. Add stocks first.";
        return;
    }

    const symbols = portfolio.map(stock => stock.symbol);
    const weights = portfolio.map(stock => stock.weight / 100);

    console.log("🔍 Sending API Request with:", JSON.stringify({ symbols, weights }, null, 2)); // ✅ Debug Request

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols, weights })
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

        const result = await response.json();
        
        console.log("📩 Full API Response (Debug):", JSON.stringify(result, null, 2)); // ✅ Print full readable response

        if (!result.VaR_Table) {
            console.error("🚨 Error: VaR data missing in API response.");
            document.getElementById("varResult").innerText = "Error: No valid VaR data available.";
            return;
        }

        let tableHtml = `<table border="1">
            <tr><th>Security</th><th>VaR 1-Day (95%)</th><th>VaR 1-Day (99%)</th><th>VaR 1-Week (95%)</th><th>VaR 1-Week (99%)</th></tr>`;

        result.VaR_Table.forEach(row => {
            tableHtml += `<tr><td>${row.security || "Portfolio"}</td><td>${row["VaR 1-Day (95%)"] || "-"}</td><td>${row["VaR 1-Day (99%)"] || "-"}</td><td>${row["VaR 1-Week (95%)"] || "-"}</td><td>${row["VaR 1-Week (99%)"] || "-"}</td></tr>`;
        });

        tableHtml += `</table>`;
        document.getElementById("varResult").innerHTML = tableHtml;

    } catch (error) {
        console.error("🚨 Error fetching VaR:", error);
        document.getElementById("varResult").innerText = "Error calculating Portfolio VaR.";
    }
}
