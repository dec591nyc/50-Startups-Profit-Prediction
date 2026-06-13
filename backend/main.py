import os
import sys
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add backend directory to path to enable imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from encoders import CustomOneHotEncoder, BetaTargetEncoder
from regressor import CustomMultipleLinearRegression, evaluate_predictions

app = FastAPI(title="50 Startups Profit Prediction API")

# Enable CORS for the decoupled frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data helper
def get_data_df():
    # Look for CSV in parent directory's data/ folder first
    project_root = os.path.dirname(current_dir)
    csv_path = os.path.join(project_root, "data", "50_Startups.csv")
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    else:
        # Fallback to online source
        url = "https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv"
        return pd.read_csv(url)

# Request schemas
class TrainRequest(BaseModel):
    encoding_choice: str  # "ohe" | "bte"
    smoothing: float = 2.0
    train_ratio: float = 0.8

class PredictRequest(BaseModel):
    rd_spend: float
    admin_spend: float
    marketing_spend: float
    state: str
    encoding_choice: str
    smoothing: float = 2.0
    train_ratio: float = 0.8

@app.get("/api/data")
def read_data():
    try:
        df = get_data_df()
        # Convert to dictionary format
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/whitepaper")
def get_whitepaper():
    try:
        project_root = os.path.dirname(current_dir)
        wp_path = os.path.join(project_root, "frontend", "whitepaper", "technical_whitepaper.md")
        if os.path.exists(wp_path):
            with open(wp_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content}
        else:
            raise HTTPException(status_code=404, detail="Whitepaper not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nblm-presentation")
def get_nblm_presentation():
    try:
        project_root = os.path.dirname(current_dir)
        pres_path = os.path.join(project_root, "frontend", "nblm", "nblm_presentation.md")
        if os.path.exists(pres_path):
            with open(pres_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content}
        else:
            raise HTTPException(status_code=404, detail="Presentation not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/train")
def train_model(req: TrainRequest):
    try:
        df = get_data_df()
        
        # 1. Train-test split using a fixed seed for reproducibility
        np.random.seed(42)
        shuffled_indices = np.random.permutation(len(df))
        train_size = int(len(df) * req.train_ratio)
        train_idx = shuffled_indices[:train_size]
        test_idx = shuffled_indices[train_size:]
        
        train_df = df.iloc[train_idx].copy().reset_index(drop=True)
        test_df = df.iloc[test_idx].copy().reset_index(drop=True)
        
        # 2. Encode categorical variables
        if req.encoding_choice == "ohe":
            encoder = CustomOneHotEncoder(drop_first=True)
            encoder.fit(train_df[["State"]])
            
            X_train = pd.concat([
                train_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(train_df[["State"]])
            ], axis=1)
            
            X_test = pd.concat([
                test_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(test_df[["State"]])
            ], axis=1)
        else:
            encoder = BetaTargetEncoder(smoothing=req.smoothing)
            encoder.fit(train_df[["State"]], train_df["Profit"])
            
            X_train = pd.concat([
                train_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(train_df[["State"]])
            ], axis=1)
            
            X_test = pd.concat([
                test_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(test_df[["State"]])
            ], axis=1)
            
        y_train = train_df["Profit"]
        y_test = test_df["Profit"]
        
        # 3. Train multiple linear regression
        lr = CustomMultipleLinearRegression(fit_intercept=True)
        lr.fit(X_train, y_train)
        
        # 4. Compute metrics
        y_train_pred = lr.predict(X_train)
        y_test_pred = lr.predict(X_test)
        
        train_metrics = evaluate_predictions(y_train, y_train_pred, len(y_train), X_train.shape[1])
        test_metrics = evaluate_predictions(y_test, y_test_pred, len(y_test), X_test.shape[1])
        
        # 5. Format equation
        equation = f"Profit = {lr.intercept_:.2f}"
        for feat, coef in zip(lr.feature_names_, lr.coefficients_):
            sign = "+" if coef >= 0 else "-"
            equation += f" {sign} {abs(coef):.4f} * ({feat})"
            
        # 6. Format OLS summary table
        summary_table = lr.summary_table().to_dict(orient="records")
        
        # 7. Package parallel metrics comparison
        # (Evaluate the other encoder model on the fly to provide a comparison)
        if req.encoding_choice == "ohe":
            bte_parallel = BetaTargetEncoder(smoothing=req.smoothing).fit(train_df[["State"]], y_train)
            X_train_bte = pd.concat([train_df[["R&D Spend", "Administration", "Marketing Spend"]], bte_parallel.transform(train_df[["State"]])], axis=1)
            X_test_bte = pd.concat([test_df[["R&D Spend", "Administration", "Marketing Spend"]], bte_parallel.transform(test_df[["State"]])], axis=1)
            lr_bte = CustomMultipleLinearRegression().fit(X_train_bte, y_train)
            comp_metrics = evaluate_predictions(y_test, lr_bte.predict(X_test_bte), len(y_test), X_test_bte.shape[1])
            ohe_metrics_res = test_metrics
            bte_metrics_res = comp_metrics
        else:
            ohe_parallel = CustomOneHotEncoder(drop_first=True).fit(train_df[["State"]])
            X_train_ohe = pd.concat([train_df[["R&D Spend", "Administration", "Marketing Spend"]], ohe_parallel.transform(train_df[["State"]])], axis=1)
            X_test_ohe = pd.concat([test_df[["R&D Spend", "Administration", "Marketing Spend"]], ohe_parallel.transform(test_df[["State"]])], axis=1)
            lr_ohe = CustomMultipleLinearRegression().fit(X_train_ohe, y_train)
            comp_metrics = evaluate_predictions(y_test, lr_ohe.predict(X_test_ohe), len(y_test), X_test_ohe.shape[1])
            ohe_metrics_res = comp_metrics
            bte_metrics_res = test_metrics
            
        # 8. Visual plot data points
        plot_records = []
        all_pred = lr.predict(pd.concat([X_train, X_test], axis=0))
        all_df = pd.concat([train_df, test_df], axis=0).reset_index(drop=True)
        for i, row in all_df.iterrows():
            plot_records.append({
                "rd_spend": float(row["R&D Spend"]),
                "admin_spend": float(row["Administration"]),
                "marketing_spend": float(row["Marketing Spend"]),
                "state": str(row["State"]),
                "profit": float(row["Profit"]),
                "predicted": float(all_pred[i])
            })
            
        return {
            "equation": equation,
            "summary_table": summary_table,
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "plot_data": plot_records,
            "comparison": {
                "ohe": ohe_metrics_res,
                "bte": bte_metrics_res
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict")
def predict_profit(req: PredictRequest):
    try:
        df = get_data_df()
        
        # Recreate the train data split to fit encoders and model in backend
        np.random.seed(42)
        shuffled_indices = np.random.permutation(len(df))
        train_size = int(len(df) * req.train_ratio)
        train_idx = shuffled_indices[:train_size]
        
        train_df = df.iloc[train_idx].copy().reset_index(drop=True)
        y_train = train_df["Profit"]
        
        # Fit model based on encoding choice
        if req.encoding_choice == "ohe":
            encoder = CustomOneHotEncoder(drop_first=True)
            encoder.fit(train_df[["State"]])
            
            X_train = pd.concat([
                train_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(train_df[["State"]])
            ], axis=1)
            
            # Format input
            is_ny = 1.0 if req.state == "New York" else 0.0
            is_fl = 1.0 if req.state == "Florida" else 0.0
            input_features = pd.DataFrame({
                "R&D Spend": [req.rd_spend],
                "Administration": [req.admin_spend],
                "Marketing Spend": [req.marketing_spend],
                "State_Florida": [is_fl],
                "State_New York": [is_ny]
            })
        else:
            encoder = BetaTargetEncoder(smoothing=req.smoothing)
            encoder.fit(train_df[["State"]], y_train)
            
            X_train = pd.concat([
                train_df[["R&D Spend", "Administration", "Marketing Spend"]],
                encoder.transform(train_df[["State"]])
            ], axis=1)
            
            # Format input
            if req.state in encoder.encoding_map_:
                encoded_m, encoded_v = encoder.encoding_map_[req.state]
            else:
                encoded_m, encoded_v = encoder.default_encoding_
                
            input_features = pd.DataFrame({
                "R&D Spend": [req.rd_spend],
                "Administration": [req.admin_spend],
                "Marketing Spend": [req.marketing_spend],
                "State_BTE_mean": [encoded_m],
                "State_BTE_var": [encoded_v]
            })
            
        lr = CustomMultipleLinearRegression().fit(X_train, y_train)
        
        # Predict
        predicted_val = lr.predict(input_features)[0]
        
        # 95% CI calculation: +/- 1.96 * RMSE
        # Calculate RMSE on train set for simplicity in predict endpoints
        y_pred = lr.predict(X_train)
        rmse_val = np.sqrt(np.mean((y_train - y_pred) ** 2))
        
        lower_bound = max(0.0, predicted_val - 1.96 * rmse_val)
        upper_bound = predicted_val + 1.96 * rmse_val
        
        return {
            "predicted_profit": float(predicted_val),
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
