from js import document
from pyodide.ffi import create_proxy
import numpy as np

def calculate_rolling_var(returns, window_size=20):
    var_values = []
    for i in range(len(returns)):
        start = max(0, i - window_size + 1)
        window = returns[start:i + 1]
        if len(window) < 5:
            var_values.append(0)
        else:
            sorted_window = sorted(window)
            var95 = -sorted_window[int(len(sorted_window) * 0.05)]
            var_values.append(var95)
    return var_values

def calculate_rolling_volatility(returns, window_size=20):
    vol_values = []
    for i in range(len(returns)):
        start = max(0, i - window_size + 1)
        window = returns[start:i + 1]
        if len(window) < 5:
            vol_values.append(0)
        else:
            mean = np.mean(window)
            variance = np.mean([(x - mean) ** 2 for x in window])
            vol_values.append(np.sqrt(variance))
    return vol_values

def calculate_sharpe_ratio(prices):
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    mean_return = np.mean(returns)
    std_dev = np.std(returns)
    risk_free_rate = 0.01 / 252  # 1% annual, daily
    sharpe = (mean_return - risk_free_rate) / std_dev if std_dev != 0 else 0
    return sharpe * np.sqrt(252)  # Annualized

async def process_metrics(prices):
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    rolling_var = calculate_rolling_var(returns)
    rolling_vol = calculate_rolling_volatility(returns)
    sharpe = calculate_sharpe_ratio(prices)
    document.getElementById("sharpeRatio").innerHTML = f"<p>Sharpe Ratio (Annualized): {sharpe:.2f}</p>"
    return [0] + rolling_var, [0] + rolling_vol

# Expose to JavaScript
window.processMetrics = create_proxy(process_metrics)
