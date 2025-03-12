from js import document, window
import numpy as np
import asyncio
import json
import pyodide_http
from datetime import datetime, timedelta

FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"
pyodide_http.patch_all()

price_cache = {}
cache_expiry = timedelta(minutes=10)

async def fetch_prices(symbol):
    now = datetime.now()
    
    if symbol in price_cache and (now - price_cache[symbol]['timestamp']) < cache_expiry:
        print(f"Using cached data for {symbol}")
        return price_cache[symbol]['prices']

    try:
        url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?serietype=line&apikey={FMP_API_KEY}"
        response = await pyodide_http.pyfetch(url)
        data = await response.json()

        historical_data = data.get("historical", [])[:252]
        prices = [entry["close"] for entry in historical_data]

        if len(prices) < 2:
            print(f"Not enough data for {symbol}, using fallback simulation")
            return np.random.normal(100, 10, 252).tolist()

        price_cache[symbol] = {"prices": prices[::-1], "timestamp": now}
        return price_cache[symbol]['prices']
    
    except Exception as e:
        print(f"❌ Error fetching prices for {symbol}: {e}")
        return np.random.normal(100, 10, 252).tolist()

def calculate_portfolio_var(prices, weights):
    prices = np.array(prices)
    returns = np.diff(np.log(prices), axis=1)

    if returns.shape[1] < 2:
        print("❌ Insufficient historical data for calculation")
        return 0

    cov_matrix = np.cov(returns)
    portfolio_var = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights))) * np.sqrt(252)
    return portfolio_var

async def process_portfolio_var(symbols, weights):
    print("📡 Fetching historical prices for:", symbols)
    
    prices = []
    for symbol in symbols:
        stock_prices = await fetch_prices(symbol)
        prices.append(stock_prices)

    var_result = calculate_portfolio_var(prices, weights)

    document.getElementById("varResult").innerHTML = f"📊 Portfolio VaR: {var_result:.2f}"
    return var_result

# Ensure PyScript is fully loaded before registering function
def register_pyscript_function():
    window.processPortfolioVar = process_portfolio_var
    print("✅ PyScript function registered successfully")

document.addEventListener('pyscript-ready', register_pyscript_function)
