import requests
import pandas as pd
import numpy as np

# Sample data
data = []
for i in range(30):
    data.append({
        "codigo": "1",
        "descricao": "teste",
        "periodo": f"2023-{i % 12 + 1:02d}",
        "valor": float(i + np.random.normal(0, 5))
    })

payload = {
    "dataset": data,
    "horizon": 12,
    "test_size": 12,
    "arima_p": 1,
    "arima_d": 1,
    "arima_q": 1
}

# Assume backend is running on 8000
try:
    response = requests.post("http://localhost:8000/api/forecast", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
