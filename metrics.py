from js import document
import numpy as np
import asyncio

# Dummy function to simulate fetching stock price data
async def fetch_prices(symbol):
    return np.random.normal(100, 10, 252).tolist()  # Simulated 252-day prices

def calculate_portfolio_var(prices, weights):
    returns = np.diff(np.log(prices), axis=1)  # Calculate log returns
    cov_matrix = np.cov(returns)
    portfolio_var = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights))) * np.sqrt(252)
    return portfolio_var

async def process_portfolio_var(symbols, weights):
    print("Processing Portfolio VaR for:", symbols)
    
    prices = []
    for symbol in symbols:
        prices.append(await fetch_prices(symbol))

    prices = np.array(prices)  # Convert to numpy array

    var_result = calculate_portfolio_var(prices, weights)
    
    document.getElementById("varResult").innerHTML = f"Portfolio VaR: {var_result:.2f}"
    return var_result

window.processPortfolioVar = process_portfolio_var
