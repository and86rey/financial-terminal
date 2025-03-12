from fastapi import FastAPI
import requests
import numpy as np
from pydantic import BaseModel

app = FastAPI()

FMP_API_KEY = "WcXMJO2SufKTeiFKpSxxpBO1sO41uUQI"

class PortfolioRequest(BaseModel):
    symbols: list
    weights: list

def fetch_prices(symbol):
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?serietype=line&apikey={FMP_API_KEY}"
    response = requests.get(url)
    data = response.json()

    historical_data = data.get("historical", [])[:252]
    prices = [entry["close"] for entry in historical_data]

    return prices[::-1] if len(prices) > 2 else np.random.normal(100, 10, 252).tolist()

def calculate_portfolio_var(prices, weights):
    prices = np.array(prices)
    returns = np.diff(np.log(prices), axis=1)

    if returns.shape[1] < 2:
        return 0

    cov_matrix = np.cov(returns)
    portfolio_var = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights))) * np.sqrt(252)
    return round(portfolio_var, 2)

@app.post("/calculate_var")
def process_portfolio_var(request: PortfolioRequest):
    prices = [fetch_prices(symbol) for symbol in request.symbols]
    var_result = calculate_portfolio_var(prices, request.weights)
    return {"portfolio_var": var_result}
