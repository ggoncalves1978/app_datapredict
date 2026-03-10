import numpy as np
import traceback

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    train = np.array([100.0, 110.0, 105.0, 120.0, 115.0, 130.0, 125.0, 140.0, 135.0, 150.0])
    test = np.array([145.0, 160.0])
    
    print("Treinando hw 1")
    model = ExponentialSmoothing(train, trend='add', seasonal=None, initialization_method="estimated").fit()
    print("Previsoes:", model.forecast(steps=len(test)))
    
    print("Treinando hw final")
    full_model = ExponentialSmoothing(np.concatenate([train, test]), trend='add', seasonal=None, initialization_method="estimated").fit()
    
    residuals = full_model.resid
    print("Residuos dtype:", type(residuals))
    
    print("Sucesso!")
except Exception as e:
    print("Erro:")
    traceback.print_exc()
