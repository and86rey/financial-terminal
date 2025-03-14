from fastapi import FastAPI, HTTPException
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
    weights: list = []

def fetch_prices(symbol):
    """Fetch the most recent 252 historical prices from FMP API."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)
    
    if response.status_code != 200:
        print(f"Error fetching data for {symbol}: {response.status_code}")
        return {}

    data = response.json()
    if "historical" in data and len(data["historical"]) > 0:
        # Sort the data by date (newest first)
        historical_data = sorted(data["historical"], key=lambda x: x["date"], reverse=True)

        # Take the most recent 252 days
        prices = {entry["date"]: entry["close"] for entry in historical_data[:252]}
        
        if len(prices) == 0:
            print(f"Warning: No sufficient historical data for {symbol}")
        return prices

    print(f"Warning: No historical data found for {symbol}")
    return {}

@app.post("/fetch_prices")
def get_prices(request: PortfolioRequest):
    """Returns historical price data for each requested security."""
    if not request.symbols or len(request.symbols) == 0:
        raise HTTPException(status_code=422, detail="No symbols provided")

    prices_data = {}
    for symbol in request.symbols:
        prices = fetch_prices(symbol)
        if prices:
            prices_data[symbol] = prices
        else:
            prices_data[symbol] = {}  # Ensure empty data is handled properly

    return {"prices": prices_data}

@app.post("/calculate_var")
def calculate_var(request: PortfolioRequest):
    """Calculates Value at Risk (VaR) at portfolio level and for individual securities."""
    if not request.symbols or len(request.symbols) == 0:
        raise HTTPException(status_code=422, detail="No symbols provided for VaR calculation")

    prices_dict = {symbol: fetch_prices(symbol) for symbol in request.symbols}
    
    if any(not prices for prices in prices_dict.values()):
        raise HTTPException(status_code=422, detail="One or more securities lack sufficient data")

    log_returns = {}
    for symbol, prices in prices_dict.items():
        price_series = np.array(list(prices.values()))
        if len(price_series) < 2:
            continue  # Not enough data to compute log returns
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

    if request.weights:
        weights = np.array(request.weights) / 100
        portfolio_returns = np.column_stack([log_returns[symbol] for symbol in request.symbols if symbol in log_returns])
        
        if portfolio_returns.shape[1] > 0:
            portfolio_var_1d_95 = norm.ppf(0.05, np.mean(portfolio_returns), np.std(portfolio_returns))
            portfolio_var_1d_99 = norm.ppf(0.01, np.mean(portfolio_returns), np.std(portfolio_returns))

            var_results["Portfolio"] = {
                "VaR_1d_95": round(portfolio_var_1d_95, 6),
                "VaR_1d_99": round(portfolio_var_1d_99, 6),
            }
        else:
            var_results["Portfolio"] = {"VaR_1d_95": "N/A", "VaR_1d_99": "N/A"}

    return var_results
