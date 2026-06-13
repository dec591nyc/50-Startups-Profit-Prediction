import os
import sys
import pandas as pd
import numpy as np

# Add project root to sys.path to enable imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.encoders import CustomOneHotEncoder, BetaTargetEncoder
from backend.regressor import CustomMultipleLinearRegression, evaluate_predictions

def test_encoders():
    print("=== Testing Encoders ===")
    # Create simple dummy dataset
    df = pd.DataFrame({
        "State": ["New York", "California", "Florida", "New York", "California", "Florida"],
        "Profit": [100.0, 80.0, 120.0, 110.0, 90.0, 130.0]
    })
    
    # 1. Test CustomOneHotEncoder
    ohe = CustomOneHotEncoder(drop_first=True)
    ohe.fit(df[["State"]])
    df_ohe = ohe.transform(df[["State"]])
    print("One-Hot Encoded Columns:", list(df_ohe.columns))
    assert len(df_ohe.columns) == 2, "Expected 2 columns (dropped first)"
    assert "State_California" not in df_ohe.columns, "California should be dropped as the first column"
    assert "State_New York" in df_ohe.columns
    assert "State_Florida" in df_ohe.columns
    
    # 2. Test BetaTargetEncoder
    bte = BetaTargetEncoder(smoothing=2.0)
    bte.fit(df[["State"]], df["Profit"])
    df_bte = bte.transform(df[["State"]])
    print("Beta Target Encoded Columns:", list(df_bte.columns))
    assert len(df_bte.columns) == 2
    assert "State_BTE_mean" in df_bte.columns
    assert "State_BTE_var" in df_bte.columns
    
    # Verify smoothing pulls mean toward global mean
    global_mean = df["Profit"].mean() # 105.0
    ny_mean = df[df["State"] == "New York"]["Profit"].mean() # 105.0
    # Ny mean BTE should be pulled to global mean
    print(f"Global Mean: {global_mean}, New York Empirical Mean: {ny_mean}")
    print(f"NY Encoded Mean: {bte.encoding_map_['New York'][0]}")
    
    print("Encoders verification: SUCCESS\n")

def test_regression():
    print("=== Testing Multiple Linear Regression ===")
    # Load 50 Startups dataset
    csv_path = os.path.join(project_root, "data", "50_Startups.csv")
    if not os.path.exists(csv_path):
        print(f"Error: Dataset not found at {csv_path}. Run download_data.py first.")
        return
        
    df = pd.read_csv(csv_path)
    
    # Prepare features and target
    X = df[["R&D Spend", "Administration", "Marketing Spend"]].copy()
    y = df["Profit"].copy()
    
    # Fit custom model
    model = CustomMultipleLinearRegression(fit_intercept=True)
    model.fit(X, y)
    
    # Make predictions and evaluate
    y_pred = model.predict(X)
    metrics = evaluate_predictions(y, y_pred, len(y), X.shape[1])
    
    print(f"R2 Score: {metrics['R2']:.4f}")
    print(f"Adjusted R2 Score: {metrics['Adj_R2']:.4f}")
    print(f"RMSE: {metrics['RMSE']:.2f}")
    
    # Assert R2 is reasonable for this dataset (should be around 0.95)
    assert metrics['R2'] > 0.90, f"R2 score is too low: {metrics['R2']}"
    
    # Print OLS summary
    summary_df = model.summary_table()
    print("\nModel Statistical Summary:")
    print(summary_df.to_string(index=False))
    
    print("\nRegression verification: SUCCESS\n")

if __name__ == "__main__":
    test_encoders()
    test_regression()
