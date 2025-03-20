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
    
    if not opt_result.success:
        print("Optimization failed:", opt_result.message)
        return None
    
    return opt_result.x

@app.post("/optimize_portfolio")
def optimize_portfolio_endpoint(request: PortfolioRequest):
    if not request.symbols or len(request.symbols) < 2:
        raise HTTPException(status_code=422, detail="At least two assets are required for optimization.")
    
    returns = []
    missing_data_assets = []
    
    for symbol in request.symbols:
        prices = fetch_prices(symbol)
        if len(prices) < 2:
            missing_data_assets.append(symbol)
            continue
        returns.append(np.diff(np.log(prices)))
    
    if missing_data_assets:
        return {"error": f"Not enough historical data for: {', '.join(missing_data_assets)}. Try different assets."}
    
    returns = np.array(returns)
    optimal_weights = optimize_portfolio(returns)
    
    if optimal_weights is None or np.all(optimal_weights == 0):
        return {"error": "Optimization failed. Possible reasons: assets are highly correlated or no valid solution exists."}
    
    return {"optimal_weights": {symbol: round(w, 4) for symbol, w in zip(request.symbols, optimal_weights)}}
