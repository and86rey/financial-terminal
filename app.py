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

class PortfolioRequest(BaseModel):
    symbols: List[str]
    weights: List[float]

def fetch_prices(symbol):
    """Fetch the most recent 252 historical prices from FMP API."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)

    if response.status_code != 200:
        print(f"Error fetching data for {symbol}: {response.status_code}")
        return {}

    data = response.json()
    if "historical" in data and len(data["historical"]) > 0:
        historical_data = sorted(data["historical"], key=lambda x: x["date"], reverse=True)
        prices = {entry["date"]: entry["close"] for entry in historical_data[:252]}
        return prices

    return {}

def historical_var(returns, confidence_level):
    """Calculate Historical Simulation VaR at a given confidence level."""
    percentile = 100 - confidence_level
    return np.percentile(returns, percentile)

def monte_carlo_var(mean, std, confidence_level, simulations=10000):
    """Monte Carlo simulation for VaR."""
    simulated_returns = np.random.normal(mean, std, simulations)
    return np.percentile(simulated_returns, 100 - confidence_level)

def cornish_fisher_var(mean, std, returns, confidence_level):
    """Cornish-Fisher Expansion VaR, adjusting for skewness and kurtosis."""
    z_score = norm.ppf(1 - confidence_level / 100)
    skewness = skew(returns)
    excess_kurtosis = kurtosis(returns, fisher=True)

    z_adj = z_score + (1/6) * (z_score**2 - 1) * skewness + (1/24) * (z_score**3 - 3 * z_score) * excess_kurtosis
    return mean + z_adj * std

@app.post("/calculate_var")
def calculate_var(request: PortfolioRequest):
    """Calculates Portfolio-Level VaR along with individual security VaR."""
    if not request.symbols or len(request.symbols) == 0:
        raise HTTPException(status_code=422, detail="No symbols provided for VaR calculation")

    prices_dict = {symbol: fetch_prices(symbol) for symbol in request.symbols}
    
    if any(not prices for prices in prices_dict.values()):
        raise HTTPException(status_code=422, detail="One or more securities lack sufficient data")

    log_returns = {}
    expected_returns = {}

    for symbol, prices in prices_dict.items():
        price_series = np.array(list(prices.values()))
        if len(price_series) < 2:
            continue  

        log_returns[symbol] = np.diff(np.log(price_series))
        expected_returns[symbol] = np.mean(log_returns[symbol]) * 252  

    var_results = {}

    # Individual security VaR calculations
    for symbol, returns in log_returns.items():
        if len(returns) == 0:
            var_results[symbol] = {
                "Normal_VaR_1D_95": "N/A", "Normal_VaR_1D_99": "N/A",
                "Hist_VaR_1D_95": "N/A", "Hist_VaR_1D_99": "N/A",
                "MonteCarlo_VaR_1D_95": "N/A", "MonteCarlo_VaR_1D_99": "N/A",
                "CornishFisher_VaR_1D_95": "N/A", "CornishFisher_VaR_1D_99": "N/A",
                "Expected_Annual_Return": "N/A"
            }
            continue

        mean, std = np.mean(returns), np.std(returns)

        var_results[symbol] = {
            "Normal_VaR_1D_95": round(norm.ppf(0.05, mean, std), 6),
            "Normal_VaR_1D_99": round(norm.ppf(0.01, mean, std), 6),
            "Hist_VaR_1D_95": round(historical_var(returns, 95), 6),
            "Hist_VaR_1D_99": round(historical_var(returns, 99), 6),
            "MonteCarlo_VaR_1D_95": round(monte_carlo_var(mean, std, 95), 6),
            "MonteCarlo_VaR_1D_99": round(monte_carlo_var(mean, std, 99), 6),
            "CornishFisher_VaR_1D_95": round(cornish_fisher_var(mean, std, returns, 95), 6),
            "CornishFisher_VaR_1D_99": round(cornish_fisher_var(mean, std, returns, 99), 6),
            "Expected_Annual_Return": round(expected_returns[symbol], 6)
        }

    # Portfolio-Level VaR Calculation
    returns_matrix = np.column_stack(list(log_returns.values()))
    weights = np.array(request.weights) / 100  
    cov_matrix = np.cov(returns_matrix, rowvar=False)  
    portfolio_volatility = np.sqrt(weights.T @ cov_matrix @ weights)  

    var_results["Portfolio"] = {
        "Normal_VaR_1D_95": round(norm.ppf(0.05, 0, portfolio_volatility), 6),
        "Normal_VaR_1D_99": round(norm.ppf(0.01, 0, portfolio_volatility), 6),
        "Hist_VaR_1D_95": round(historical_var(np.dot(returns_matrix, weights), 95), 6),
        "Hist_VaR_1D_99": round(historical_var(np.dot(returns_matrix, weights), 99), 6),
        "MonteCarlo_VaR_1D_95": round(monte_carlo_var(0, portfolio_volatility, 95), 6),
        "MonteCarlo_VaR_1D_99": round(monte_carlo_var(0, portfolio_volatility, 99), 6),
        "CornishFisher_VaR_1D_95": round(cornish_fisher_var(0, portfolio_volatility, np.dot(returns_matrix, weights), 95), 6),
        "CornishFisher_VaR_1D_99": round(cornish_fisher_var(0, portfolio_volatility, np.dot(returns_matrix, weights), 99), 6),
        "Expected_Annual_Return": round(np.dot(weights, list(expected_returns.values())), 6)
    }

    return var_results
