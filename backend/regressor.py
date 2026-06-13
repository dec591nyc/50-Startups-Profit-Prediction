import numpy as np
import pandas as pd
from scipy import stats

class CustomMultipleLinearRegression:
    """
    Multiple Linear Regression solver using the analytical closed-form solution:
    beta = (X^T X)^(-1) X^T y
    Includes standard error, t-statistic, and p-value computations for white-box inference.
    """
    def __init__(self, fit_intercept=True):
        self.fit_intercept = fit_intercept
        self.coefficients_ = None
        self.intercept_ = None
        self.beta_ = None  # Combined intercept and coefficients
        
        # Inference attributes
        self.feature_names_ = None
        self.se_ = None
        self.t_stats_ = None
        self.p_values_ = None
        self.residuals_ = None
        self.n_samples_ = None
        self.n_features_ = None
        self.df_ = None
        self.r_squared_ = None
        self.adj_r_squared_ = None
        
    def fit(self, X, y):
        # Convert X and y to numpy arrays
        X_arr = np.array(X, dtype=float)
        y_arr = np.array(y, dtype=float).reshape(-1, 1)
        
        self.n_samples_, self.n_features_ = X_arr.shape
        
        if isinstance(X, pd.DataFrame):
            self.feature_names_ = list(X.columns)
        else:
            self.feature_names_ = [f"x{i}" for i in range(self.n_features_)]
            
        # Add column of ones for intercept
        if self.fit_intercept:
            X_design = np.hstack([np.ones((self.n_samples_, 1)), X_arr])
            features_with_intercept = ["Intercept"] + self.feature_names_
        else:
            X_design = X_arr
            features_with_intercept = self.feature_names_
            
        # Solve OLS: beta = (X^T * X)^(-1) * X^T * y
        try:
            # Using pseudo-inverse to handle potential singular matrices gracefully
            X_XT_inv = np.linalg.pinv(X_design.T @ X_design)
            self.beta_ = X_XT_inv @ X_design.T @ y_arr
        except np.linalg.LinAlgError:
            # Fallback in case of numeric instabilities
            self.beta_ = np.linalg.lstsq(X_design, y_arr, rcond=None)[0]
            X_XT_inv = np.linalg.pinv(X_design.T @ X_design)
            
        # Separate coefficients and intercept
        if self.fit_intercept:
            self.intercept_ = self.beta_[0][0]
            self.coefficients_ = self.beta_[1:].flatten()
        else:
            self.intercept_ = 0.0
            self.coefficients_ = self.beta_.flatten()
            
        # Residuals and Predictions
        y_pred = X_design @ self.beta_
        self.residuals_ = y_arr - y_pred
        
        # Calculate R^2 and Adj R^2
        y_mean = y_arr.mean()
        ss_tot = np.sum((y_arr - y_mean) ** 2)
        ss_res = np.sum(self.residuals_ ** 2)
        
        self.r_squared_ = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
        
        p_num = X_design.shape[1]  # Number of parameters
        self.df_ = self.n_samples_ - p_num
        
        if self.n_samples_ > p_num:
            self.adj_r_squared_ = 1.0 - ((ss_res / self.df_) / (ss_tot / (self.n_samples_ - 1)))
        else:
            self.adj_r_squared_ = self.r_squared_
            
        # Statistical Inference Calculations (Standard Errors, t-stats, p-values)
        if self.df_ > 0:
            # Unbiased estimate of residual variance s^2 = e^T * e / (n - p)
            s_squared = ss_res / self.df_
            
            # Covariance matrix of beta: s^2 * (X^T * X)^(-1)
            cov_beta = s_squared * X_XT_inv
            
            # Standard errors of beta
            self.se_ = np.sqrt(np.diag(cov_beta))
            
            # t-statistics
            self.t_stats_ = self.beta_.flatten() / self.se_
            
            # p-values using Student's t cumulative distribution function (two-tailed)
            self.p_values_ = 2 * (1 - stats.t.cdf(np.abs(self.t_stats_), df=self.df_))
        else:
            self.se_ = np.zeros_like(self.beta_.flatten())
            self.t_stats_ = np.zeros_like(self.beta_.flatten())
            self.p_values_ = np.ones_like(self.beta_.flatten())
            
        return self
        
    def predict(self, X):
        X_arr = np.array(X, dtype=float)
        if self.fit_intercept:
            return X_arr @ self.coefficients_ + self.intercept_
        else:
            return X_arr @ self.coefficients_
            
    def summary_table(self):
        """
        Generates a summary dataframe mimicking statsmodels OLS summary table.
        """
        features = ["Intercept"] + self.feature_names_ if self.fit_intercept else self.feature_names_
        summary_df = pd.DataFrame({
            "Feature": features,
            "Coefficient": self.beta_.flatten(),
            "Std Error": self.se_,
            "t-Statistic": self.t_stats_,
            "p-Value": self.p_values_
        })
        return summary_df


def evaluate_predictions(y_true, y_pred, n_samples=None, n_features=None):
    """
    Computes standard regression evaluation metrics.
    """
    y_t = np.array(y_true, dtype=float).flatten()
    y_p = np.array(y_pred, dtype=float).flatten()
    
    mae = np.mean(np.abs(y_t - y_p))
    mse = np.mean((y_t - y_p) ** 2)
    rmse = np.sqrt(mse)
    
    # R-squared
    y_mean = np.mean(y_t)
    ss_tot = np.sum((y_t - y_mean) ** 2)
    ss_res = np.sum((y_t - y_p) ** 2)
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
    
    # Adjusted R-squared
    if n_samples is not None and n_features is not None:
        p_num = n_features + 1 # counting intercept
        df = n_samples - p_num
        if df > 0:
            adj_r2 = 1.0 - ((ss_res / df) / (ss_tot / (n_samples - 1)))
        else:
            adj_r2 = r2
    else:
        adj_r2 = r2
        
    return {
        "MAE": mae,
        "MSE": mse,
        "RMSE": rmse,
        "R2": r2,
        "Adj_R2": adj_r2
    }
