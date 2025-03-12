from js import document
import numpy as np

def calculate_portfolio_var(prices, weights):
    cov_matrix = np.cov(prices, rowvar=False)
    portfolio_var = np.dot(weights, np.dot(cov_matrix, weights)) ** 0.5
    return portfolio_var

async def process_portfolio_var(symbols, weights):
    prices = [await fetch_prices(symbol) for symbol in symbols]
    var_result = calculate_portfolio_var(prices, weights)
    
    document.getElementById("varResult").innerHTML = f"Portfolio VaR: {var_result:.2f}"
    return var_result

window.processPortfolioVar = process_portfolio_var
