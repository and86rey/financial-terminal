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
    return sharpe * np.sqrt(252)

def calculate_sortino_ratio(prices):
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    mean_return = np.mean(returns)
    downside_returns = [r for r in returns if r < 0]
    downside_std = np.std(downside_returns) if downside_returns else 0
    risk_free_rate = 0.01 / 252
    sortino = (mean_return - risk_free_rate) / downside_std if downside_std != 0 else 0
    return sortino * np.sqrt(252)

def calculate_moving_averages(prices):
    short_window = 20
    long_window = 50
    short_ma = []
    long_ma = []
    for i in range(len(prices)):
        short_start = max(0, i - short_window + 1)
        long_start = max(0, i - long_window + 1)
        short_ma.append(np.mean(prices[short_start:i + 1]) if i >= short_start else 0)
        long_ma.append(np.mean(prices[long_start:i + 1]) if i >= long_start else 0)
    return short_ma, long_ma

async def process_metrics(prices):
    print("Processing metrics in Python...")  # Debug
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    rolling_var = calculate_rolling_var(returns)
    rolling_vol = calculate_rolling_volatility(returns)
    sharpe = calculate_sharpe_ratio(prices)
    sortino = calculate_sortino_ratio(prices)
    short_ma, long_ma = calculate_moving_averages(prices)
    print("Python results:", rolling_var, rolling_vol, short_ma, long_ma)  # Debug
    document.getElementById("sharpeRatio").innerHTML = f"Sharpe Ratio (Annualized): {sharpe:.2f}"
    document.getElementById("sortinoRatio").innerHTML = f"Sortino Ratio (Annualized): {sortino:.2f}"
    return [0] + rolling_var, [0] + rolling_vol, short_ma, long_ma

window.processMetrics = create_proxy(process_metrics)
