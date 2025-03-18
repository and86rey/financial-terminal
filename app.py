from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm, kurtosis, skew
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://and86rey.github.io"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"
BENCHMARK_INDEX = "SPY"  # S&P 500 ETF as the market benchmark

class PortfolioRequest(BaseModel):
    symbols: List[str]
    weights: List[float]

def fetch_prices(symbol):
    """Fetch historical closing prices from FMP API (252 trading days)."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)

    if response.status_code != 200:
        print(f"Error fetching data for {symbol}: {response.status_code}")
        return {}

    data = response.json()
    if "historical" in data and len(data["historical"]) > 0:
        historical_data = sorted(data["historical"], key=lambda x: x["date"], reverse=True)
        prices = {entry["date"]: entry["close"] for entry in historical_data[:252]}  # 1 year of data
        return prices

    return {}

def calculate_beta(portfolio_returns, market_returns):
    """Compute Beta as Cov(Rp, Rm) / Var(Rm)"""
    if len(portfolio_returns) != len(market_returns):
        min_length = min(len(portfolio_returns), len(market_returns))
        portfolio_returns = portfolio_returns[:min_length]
        market_returns = market_returns[:min_length]

    cov_matrix = np.cov(portfolio_returns, market_returns)
    beta = cov_matrix[0, 1] / cov_matrix[1, 1]  # Cov(Rp, Rm) / Var(Rm)
    return round(beta, 4)

@app.post("/calculate_var")
def calculate_var(request: PortfolioRequest):
    """Calculate Portfolio VaR, Expected Return, and Beta."""
    if not request.symbols or len(request.symbols) == 0:
        raise HTTPException(status_code=422, detail="No symbols provided for calculation")

    # Fetch historical prices for all securities
    prices_dict = {symbol: fetch_prices(symbol) for symbol in request.symbols}
    market_prices = fetch_prices(BENCHMARK_INDEX)

    if any(not prices for prices in prices_dict.values()) or not market_prices:
        raise HTTPException(status_code=422, detail="One or more securities lack sufficient data")

    log_returns = {}
    expected_returns = {}

    for symbol, prices in prices_dict.items():
        price_series = np.array(list(prices.values()))
        if len(price_series) < 2:
            continue  
        log_returns[symbol] = np.diff(np.log(price_series))
        expected_returns[symbol] = np.mean(log_returns[symbol]) * 252  

    # Compute portfolio returns
    weights = np.array(request.weights) / 100  
    returns_matrix = np.column_stack(list(log_returns.values()))
    portfolio_returns = np.dot(returns_matrix, weights)

    # Compute market returns
    market_series = np.array(list(market_prices.values()))
    market_returns = np.diff(np.log(market_series))

    # Compute portfolio beta
    portfolio_beta = calculate_beta(portfolio_returns, market_returns)

    var_results = {"Portfolio_Beta": portfolio_beta}

    # Compute individual security VaRs
    for symbol, returns in log_returns.items():
        mean, std = np.mean(returns), np.std(returns)
        var_results[symbol] = {
            "Normal_VaR_1D_95": round(norm.ppf(0.05, mean, std), 6),
            "Normal_VaR_1D_99": round(norm.ppf(0.01, mean, std), 6),
            "Hist_VaR_1D_95": round(np.percentile(returns, 5), 6),
            "Hist_VaR_1D_99": round(np.percentile(returns, 1), 6),
            "Expected_Annual_Return": round(expected_returns[symbol], 6)
        }

    return var_results
