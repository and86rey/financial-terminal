from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
import scipy.optimize as sco
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

def calculate_portfolio_metrics(returns, weights):
    portfolio_return = np.sum(np.mean(returns, axis=1) * weights)
    portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(np.cov(returns), weights)))
    sharpe_ratio = portfolio_return / portfolio_volatility if portfolio_volatility > 0 else 0
    return portfolio_return, portfolio_volatility, sharpe_ratio

def optimize_portfolio(returns):
    num_assets = returns.shape[0]
    args = (returns,)
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0, 1) for _ in range(num_assets))
    init_guess = num_assets * [1. / num_assets]
    
    def min_func_sharpe(weights, returns):
        return -calculate_portfolio_metrics(returns, weights)[2]  # Minimize negative Sharpe Ratio
    
    opt_result = sco.minimize(min_func_sharpe, init_guess, args=args, method='SLSQP', bounds=bounds, constraints=constraints)
    return opt_result.x if opt_result.success else None

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
            "Normal_VaR_1D_95": norm.ppf(0.95, np.mean(returns), np.std(returns)),
            "Normal_VaR_1D_99": norm.ppf(0.99, np.mean(returns), np.std(returns))
        }
        portfolio_returns.append(returns)
    
    if len(portfolio_returns) > 1:
        portfolio_returns = np.column_stack(portfolio_returns)
        portfolio_return_series = np.sum(portfolio_weights * portfolio_returns, axis=1)
        
        results["Portfolio"] = {
            "Normal_VaR_1D_95": norm.ppf(0.95, np.mean(portfolio_return_series), np.std(portfolio_return_series)),
            "Normal_VaR_1D_99": norm.ppf(0.99, np.mean(portfolio_return_series), np.std(portfolio_return_series))
        }
    
    return results

@app.post("/optimize_portfolio")
def optimize_portfolio_endpoint(request: PortfolioRequest):
    if not request.symbols or len(request.symbols) < 2:
        raise HTTPException(status_code=422, detail="At least two assets are required for optimization.")
    
    returns = []
    for symbol in request.symbols:
        prices = fetch_prices(symbol)
        if len(prices) < 2:
            raise HTTPException(status_code=400, detail=f"Not enough data for {symbol}")
        returns.append(np.diff(np.log(prices)))
    
    returns = np.array(returns)
    optimal_weights = optimize_portfolio(returns)
    
    if optimal_weights is None:
        raise HTTPException(status_code=500, detail="Optimization failed.")
    
    return {"optimal_weights": {symbol: round(w, 4) for symbol, w in zip(request.symbols, optimal_weights)}}
