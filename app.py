from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://and86rey.github.io"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"

class PortfolioRequest(BaseModel):
    symbols: list
    weights: list

def fetch_prices(symbol):
    """Fetch the most recent 252 historical prices from FMP API."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)
    data = response.json()

    if "historical" in data and len(data["historical"]) >= 252:
        # Sort the data by date (newest first)
        historical_data = sorted(data["historical"], key=lambda x: x["date"], reverse=True)

        # Take the most recent 252 days
        prices = {entry["date"]: entry["close"] for entry in historical_data[:252]}

        print(f"{symbol}: {len(prices)} recent prices fetched.")
        return prices
    else:
        print(f"{symbol}: Insufficient data.")
        return {}  # Return empty dictionary if no data

@app.post("/fetch_prices")
def get_prices(request: PortfolioRequest):
    """Returns historical price data for each requested security."""
    prices_data = {symbol: fetch_prices(symbol) for symbol in request.symbols}
    return {"prices": prices_data}

@app.post("/calculate_var")
def calculate_var(request: PortfolioRequest):
    """Calculates Value at Risk (VaR) at portfolio level and for individual securities."""
    prices_dict = {symbol: fetch_prices(symbol) for symbol in request.symbols}
    
    if any(not prices for prices in prices_dict.values()):
        return {"error": "One or more securities do not have sufficient data for calculation."}

    log_returns = {}
    for symbol, prices in prices_dict.items():
        price_series = np.array(list(prices.values()))
        log_returns[symbol] = np.diff(np.log(price_series))

    var_results = {}
    for symbol, returns in log_returns.items():
        if len(returns) == 0:
            var_results[symbol] = {"VaR_1d_95": "N/A", "VaR_1d_99": "N/A"}
            continue

        mean, std = np.mean(returns), np.std(returns)
        var_1d_95 = norm.ppf(0.05, mean, std)
        var_1d_99 = norm.ppf(0.01, mean, std)
        var_results[symbol] = {
            "VaR_1d_95": round(var_1d_95, 6),
            "VaR_1d_99": round(var_1d_99, 6),
        }

    weights = np.array(request.weights) / 100
    portfolio_returns = np.column_stack([log_returns[symbol] for symbol in request.symbols])
    portfolio_var_1d_95 = norm.ppf(0.05, np.mean(portfolio_returns), np.std(portfolio_returns))
    portfolio_var_1d_99 = norm.ppf(0.01, np.mean(portfolio_returns), np.std(portfolio_returns))

    var_results["Portfolio"] = {
        "VaR_1d_95": round(portfolio_var_1d_95, 6),
        "VaR_1d_99": round(portfolio_var_1d_99, 6),
    }

    return var_results
