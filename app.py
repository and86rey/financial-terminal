from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import numpy as np
from scipy.stats import norm
from pydantic import BaseModel

app = FastAPI()

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
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{symbol}?serietype=line&apikey={FMP_API_KEY}"
    response = requests.get(url)
    data = response.json()

    if "historical" in data and len(data["historical"]) >= 252:
        historical_data = data["historical"][:252]
        return {entry["date"]: entry["close"] for entry in historical_data}
    return {}

@app.post("/fetch_prices")
def get_prices(request: PortfolioRequest):
    return {"prices": {symbol: fetch_prices(symbol) for symbol in request.symbols}}
