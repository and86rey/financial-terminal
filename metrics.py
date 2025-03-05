from js import document, fetch
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

def calculate_monte_carlo_var(prices, simulations=1000, days=20):
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    mean = np.mean(returns)
    std = np.std(returns)
    last_price = prices[-1]
    sim_paths = []
    for _ in range(simulations):
        daily_returns = np.random.normal(mean, std, days)
        path = [last_price]
        for r in daily_returns:
            path.append(path[-1] * (1 + r))
        sim_paths.append(path[-1])
    sim_returns = [(p - last_price) / last_price for p in sim_paths]
    mc_var = -np.percentile(sim_returns, 5) * last_price  # 95% VaR
    return mc_var

def calculate_correlation_matrix(prices_list):
    returns_list = []
    for prices in prices_list:
        returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
        returns_list.append(returns)
    min_length = min(len(r) for r in returns_list)
    trimmed_returns = [r[-min_length:] for r in returns_list]
    corr_matrix = np.corrcoef(trimmed_returns)
    return corr_matrix

def calculate_ma_signals(prices):
    short_window = 20
    long_window = 50
    short_ma = np.convolve(prices, np.ones(short_window)/short_window, mode='valid')
    long_ma = np.convolve(prices, np.ones(long_window)/long_window, mode='valid')
    signals = []
    for i in range(len(short_ma) - 1):
        if i < long_window - short_window:  # Adjust for valid range
            signals.append("N/A")
        elif short_ma[i] > long_ma[i] and short_ma[i-1] <= long_ma[i-1]:
            signals.append("Buy")
        elif short_ma[i] < long_ma[i] and short_ma[i-1] >= long_ma[i-1]:
            signals.append("Sell")
        else:
            signals.append("Hold")
    latest_signal = signals[-1] if signals else "N/A"
    return latest_signal

async def process_metrics(tickers):
    prices_list = []
    for ticker in tickers.split(','):
        historical_url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker.strip()}?serietype=line&apikey={FMP_API_KEY}"
        response = await fetch(historical_url)
        data = await response.json()
        historical = data.get('historical', [])
        prices = [float(day['close']) for day in historical[-252:]]  # Last 252 days
        prices_list.append(prices)

    # Single ticker metrics
    prices = prices_list[0]
    returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
    rolling_var = calculate_rolling_var(returns)
    rolling_vol = calculate_rolling_volatility(returns)
    sharpe = calculate_sharpe_ratio(prices)
    mc_var = calculate_monte_carlo_var(prices)
    ma_signal = calculate_ma_signals(prices)

    # Display single ticker metrics
    document.getElementById("sharpeRatio").innerHTML = f"<p>Sharpe Ratio (Annualized): {sharpe:.2f}</p>"
    document.getElementById("monteCarloVaR").innerHTML = f"<p>Monte Carlo VaR (95%, 20-day): ${mc_var:.2f}</p>"
    document.getElementById("maSignals").innerHTML = f"<p>Latest MA Crossover Signal: {ma_signal}</p>"

    # Correlation matrix for multiple tickers
    if len(prices_list) > 1:
        corr_matrix = calculate_correlation_matrix(prices_list)
        tickers_list = tickers.split(',')
        html = "<h4>Correlation Matrix</h4><table><tr><th></th>"
        for t in tickers_list:
            html += f"<th>{t.strip()}</th>"
        html += "</tr>"
        for i, row in enumerate(corr_matrix):
            html += f"<tr><td>{tickers_list[i].strip()}</td>"
            for val in row:
                html += f"<td>{val:.2f}</td>"
            html += "</tr>"
        html += "</table>"
        document.getElementById("correlationMatrix").innerHTML = html
    else:
        document.getElementById("correlationMatrix").innerHTML = ""

    return [0] + rolling_var, [0] + rolling_vol

# Expose to JavaScript
window.processMetrics = create_proxy(process_metrics)
