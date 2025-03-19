from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI()

GITHUB_PAGES_URL = "https://and86rey.github.io"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[GITHUB_PAGES_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"

class PortfolioRequest(BaseModel):
    symbols: List[str]
    weights: List[float]

def fetch_prices(symbol):
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?apikey={FMP_API_KEY}"
    response = requests.get(url)
    
    if response.status_code != 200:
        return []
    
    data = response.json()
    if "historical" in data:
        prices = sorted(data["historical"], key=lambda x: x["date"], reverse=True)
        return [entry["close"] for entry in prices[:252]]
    
    return []

def scale_var(var_1d, days=42):
    return round(var_1d * np.sqrt(days), 6) if isinstance(var_1d, (int, float)) else "N/A"

def calculate_var(returns, confidence_level):
    mean, std = np.mean(returns), np.std(returns)
    var_1d = norm.ppf(1 - confidence_level, mean, std)
    return round(var_1d, 6) if std > 0 else "N/A"

def historical_var(returns, confidence_level):
    if len(returns) > 0:
        var_1d = np.percentile(returns, 100 * (1 - confidence_level))
        return round(var_1d, 6)
    return "N/A"

def monte_carlo_var(returns, confidence_level):
    try:
        simulated_returns = np.random.choice(returns, 10000, replace=True)
        var_1d = np.percentile(simulated_returns, 100 * (1 - confidence_level))
        return round(var_1d, 6)
    except:
        return "N/A"

def cornish_fisher_var(returns, confidence_level):
    try:
        mean, std = np.mean(returns), np.std(returns)
        z = norm.ppf(1 - confidence_level)
        skew = np.mean((returns - mean) ** 3) / std**3
        kurt = np.mean((returns - mean) ** 4) / std**4
        adj_z = z + (z**2 - 1) * skew / 6 + (z**3 - 3 * z) * (kurt - 3) / 24
        var_1d = mean + adj_z * std
        return round(var_1d, 6)
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
        
        for key in list(results[symbol].keys()):
            results[symbol][key.replace("1D", "42D")] = scale_var(results[symbol][key], 42)
        
        portfolio_returns.append(returns)
    
    if len(portfolio_returns) > 1:
        portfolio_returns = np.column_stack(portfolio_returns)
        portfolio_return_series = np.sum(portfolio_weights * portfolio_returns, axis=1)
        
        results["Portfolio"] = {
            key: calculate_var(portfolio_return_series, 0.95) if "Normal" in key else historical_var(portfolio_return_series, 0.95)
            for key in results[request.symbols[0]].keys()
        }
    
    return results
