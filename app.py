from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI()

# Your actual GitHub Pages URL (extracted from files)
GITHUB_PAGES_URL = "https://and86rey.github.io"  

app.add_middleware(
    CORSMiddleware,
    allow_origins=[GITHUB_PAGES_URL],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Your actual FMP API Key (extracted from files)
FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"

class PortfolioRequest(BaseModel):
    symbols: List[str]
    weights: List[float]

def fetch_prices(symbol):
    """Fetch historical closing prices (252 trading days) for a given security."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)

    if response.status_code != 200:
        return []

    data = response.json()
    if "historical" in data:
        prices = sorted(data["historical"], key=lambda x: x["date"], reverse=True)
        return [entry["close"] for entry in prices[:252]]

    return []

def calculate_var(returns, confidence_level):
    """Compute Value at Risk (VaR) using Normal Distribution."""
    mean, std = np.mean(returns), np.std(returns)
    return round(norm.ppf(1 - confidence_level, mean, std), 6) if std > 0 else "N/A"

def historical_var(returns, confidence_level):
    """Compute Historical VaR using past return percentiles."""
    if len(returns) > 0:
        return round(np.percentile(returns, 100 * (1 - confidence_level)), 6)
    return "N/A"

def monte_carlo_var(returns, confidence_level):
    """Monte Carlo VaR Simulation based on random sampling."""
    try:
        simulated_returns = np.random.choice(returns, 10000, replace=True)
        return round(np.percentile(simulated_returns, 100 * (1 - confidence_level)), 6)
    except:
        return "N/A"

def cornish_fisher_var(returns, confidence_level):
    """Cornish-Fisher Expansion for Adjusted VaR Calculation."""
    try:
        mean, std = np.mean(returns), np.std(returns)
        z = norm.ppf(1 - confidence_level)
        skew = np.mean((returns - mean) ** 3) / std**3
        kurt = np.mean((returns - mean) ** 4) / std**4
        adj_z = z + (z**2 - 1) * skew / 6 + (z**3 - 3 * z) * (kurt - 3) / 24
        return round(mean + adj_z * std, 6)
    except:
        return "N/A"

@app.post("/calculate_var")
def calculate_var_endpoint(request: PortfolioRequest):
    if not request.symbols or not request.weights or sum(request.weights) == 0:
        raise HTTPException(status_code=422, detail="Invalid portfolio request.")

    results: Dict[str, Dict[str, float]] = {}
    portfolio_returns = []
    portfolio_weights = np.array(request.weights) / 100  

    returns_dict = {symbol: np.diff(np.log(fetch_prices(symbol))) for symbol in request.symbols}

    for symbol, returns in returns_dict.items():
        if len(returns) < 2:
            continue

        results[symbol] = {
            "Normal_VaR_1D_95": calculate_var(returns, 0.95),
            "Normal_VaR_1D_99": calculate_var(returns, 0.99),
            "Hist_VaR_1D_95": historical_var(returns, 0.95),
            "Hist_VaR_1D_99": historical_var(returns, 0.99),
            "MonteCarlo_VaR_1D_95": monte_carlo_var(returns, 0.95),
            "MonteCarlo_VaR_1D_99": monte_carlo_var(returns, 0.99),
            "CornishFisher_VaR_1D_95": cornish_fisher_var(returns, 0.95),
            "CornishFisher_VaR_1D_99": cornish_fisher_var(returns, 0.99),
        }

        portfolio_returns.append(returns)

    if len(portfolio_returns) > 1:
        portfolio_returns = np.column_stack(portfolio_returns)
        portfolio_return_series = np.sum(portfolio_weights * portfolio_returns, axis=1)

        results["Portfolio"] = {
            "Normal_VaR_1D_95": calculate_var(portfolio_return_series, 0.95),
            "Normal_VaR_1D_99": calculate_var(portfolio_return_series, 0.99),
            "Hist_VaR_1D_95": historical_var(portfolio_return_series, 0.95),
            "Hist_VaR_1D_99": historical_var(portfolio_return_series, 0.99),
            "MonteCarlo_VaR_1D_95": monte_carlo_var(portfolio_return_series, 0.95),
            "MonteCarlo_VaR_1D_99": monte_carlo_var(portfolio_return_series, 0.99),
            "CornishFisher_VaR_1D_95": cornish_fisher_var(portfolio_return_series, 0.95),
            "CornishFisher_VaR_1D_99": cornish_fisher_var(portfolio_return_series, 0.99),
        }

    return results
