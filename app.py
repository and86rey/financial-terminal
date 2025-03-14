from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm
from pydantic import BaseModel

app = FastAPI()

# ✅ Enable CORS for GitHub Pages frontend
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
    """Fetch historical prices from FMP API."""
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?serietype=line&apikey={FMP_API_KEY}"
    response = requests.get(url)
    data = response.json()

    print(f"📩 API Response for {symbol}: {data}")  # ✅ Log API Response for Debugging

    if "historical" in data and len(data["historical"]) >= 252:
        historical_data = data["historical"][:252]
        prices = [entry["close"] for entry in historical_data]
        print(f"✅ Fetched {len(prices)} prices for {symbol}: {prices[:5]}...")  # ✅ Print first 5 prices
        return prices[::-1]  # Ensure chronological order
    else:
        print(f"⚠️ {symbol} - No valid price data, returning empty list.")
        return None  

def calculate_portfolio_var(prices, weights, confidence_levels=[0.95, 0.99], horizons=[1, 5]):
    """
    Calculate Portfolio VaR for different confidence levels and time horizons.
    - horizons: [1, 5] → 1-day and 1-week (5 trading days)
    """
    valid_prices = [p for p in prices if p is not None]  
    if len(valid_prices) < 2:
        print("🚨 Error: Not enough valid securities to compute VaR")
        return {"error": "Not enough valid securities"}

    prices = np.array(valid_prices)
    
    print(f"✅ Price Matrix Shape: {prices.shape}")  # ✅ Check matrix shape

    returns = np.diff(np.log(prices), axis=1)
    
    if returns.shape[1] < 2:
        print("🚨 Error: Not enough return data for calculation")
        return {"error": "Not enough historical return data"}

    cov_matrix = np.cov(returns)
    
    print(f"✅ Covariance Matrix: {cov_matrix}")  # ✅ Debug covariance matrix

    portfolio_std_dev = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
    
    print(f"✅ Portfolio Standard Deviation: {portfolio_std_dev}")  # ✅ Check std deviation

    var_table = []
    for horizon in horizons:
        for confidence in confidence_levels:
            z_score = norm.ppf(confidence)
            var_value = z_score * portfolio_std_dev * np.sqrt(horizon)
            var_table.append({
                "horizon": f"{horizon} day(s)",
                "confidence_level": f"{int(confidence * 100)}%",
                "VaR": round(var_value, 2)
            })

    print(f"✅ VaR Calculation Complete: {var_table}")  # ✅ Print calculated VaRs
    return var_table

@app.post("/calculate_var")
def process_portfolio_var(request: PortfolioRequest):
    """Processes a portfolio request and returns a VaR table."""
    
    print(f"📩 Received Request: {request.symbols} with weights {request.weights}")

    prices = [fetch_prices(symbol) for symbol in request.symbols]

    if all(p is None for p in prices):
        print("🚨 Error: No valid price data for any securities.")
        return {"error": "No valid price data"}

    var_results = calculate_portfolio_var(prices, request.weights)
    
    print("📊 VaR Calculation Complete:", var_results)

    return {"VaR_Table": var_results}
