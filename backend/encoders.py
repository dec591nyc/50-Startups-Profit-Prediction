import pandas as pd
import numpy as np

class CustomOneHotEncoder:
    """
    Custom One-Hot Encoder that creates dummy variables for a categorical column,
    avoids the dummy variable trap by dropping the first category, and supports
    out-of-sample mapping (transforming unseen test data).
    """
    def __init__(self, drop_first=True):
        self.drop_first = drop_first
        self.categories_ = None
        self.column_name_ = None
        
    def fit(self, X, y=None):
        # Ensure input is a pandas Series or 1D array
        if isinstance(X, pd.DataFrame):
            # If a DataFrame is passed, take the first column
            self.column_name_ = X.columns[0]
            series = X.iloc[:, 0].astype(str)
        else:
            series = pd.Series(X).astype(str)
            self.column_name_ = "cat"
            
        # Get unique sorted categories
        self.categories_ = sorted(series.unique())
        return self
        
    def transform(self, X):
        if isinstance(X, pd.DataFrame):
            series = X.iloc[:, 0].astype(str)
        else:
            series = pd.Series(X).astype(str)
            
        # Create dummy columns
        dummies = {}
        
        # Determine categories to keep
        cats_to_encode = self.categories_[1:] if self.drop_first else self.categories_
        
        for cat in cats_to_encode:
            col_name = f"{self.column_name_}_{cat}"
            dummies[col_name] = (series == cat).astype(float)
            
        return pd.DataFrame(dummies, index=series.index)
        
    def fit_transform(self, X, y=None):
        return self.fit(X, y).transform(X)


class BetaTargetEncoder:
    """
    Beta Target Encoder for regression tasks.
    Normalizes the target variable to [0, 1], applies a Beta prior with a smoothing weight,
    calculates posterior mean and posterior variance for each category, and outputs
    both mean and variance features scaled back to the original target scale.
    """
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.global_mean_ = None
        self.global_var_ = None
        self.y_min_ = None
        self.y_max_ = None
        self.y_range_ = None
        
        self.encoding_map_ = {} # Maps category -> (encoded_mean, encoded_variance)
        self.column_name_ = None
        
    def fit(self, X, y):
        # Process input categorical feature
        if isinstance(X, pd.DataFrame):
            self.column_name_ = X.columns[0]
            series = X.iloc[:, 0].astype(str)
        else:
            series = pd.Series(X).astype(str)
            self.column_name_ = "cat"
            
        # Process target variable
        y_arr = np.array(y, dtype=float)
        self.y_min_ = y_arr.min()
        self.y_max_ = y_arr.max()
        self.y_range_ = self.y_max_ - self.y_min_
        
        # Avoid division by zero if target is constant
        if self.y_range_ == 0:
            self.y_range_ = 1.0
            
        # 1. Normalize target to [0, 1]
        y_norm = (y_arr - self.y_min_) / self.y_range_
        
        # 2. Compute prior parameters (on normalized scale)
        p = y_norm.mean()
        self.global_mean_ = y_arr.mean()
        self.global_var_ = y_arr.var()
        
        # Prior parameters alpha and beta
        alpha_prior = self.smoothing * p
        beta_prior = self.smoothing * (1 - p)
        
        # Unseen category defaults (based on prior)
        unseen_mean = self.global_mean_
        # Posterior variance with no category observations is the prior variance
        unseen_var_norm = (alpha_prior * beta_prior) / ((alpha_prior + beta_prior)**2 * (alpha_prior + beta_prior + 1))
        unseen_var = unseen_var_norm * (self.y_range_**2)
        
        self.default_encoding_ = (unseen_mean, unseen_var)
        
        # 3. Calculate category-level statistics
        df_temp = pd.DataFrame({"cat": series, "y_norm": y_norm})
        grouped = df_temp.groupby("cat")
        
        self.encoding_map_ = {}
        for cat, group in grouped:
            n_c = len(group)
            S_c = group["y_norm"].sum()
            
            # Posterior alpha and beta
            alpha_c = alpha_prior + S_c
            beta_c = beta_prior + (n_c - S_c)
            
            # Posterior mean (normalized scale)
            mu_c = alpha_c / (alpha_c + beta_c)
            
            # Posterior variance (normalized scale)
            var_c = (alpha_c * beta_c) / ((alpha_c + beta_c)**2 * (alpha_c + beta_c + 1))
            
            # Scale back to original target units
            encoded_mean = mu_c * self.y_range_ + self.y_min_
            encoded_var = var_c * (self.y_range_**2)
            
            self.encoding_map_[cat] = (encoded_mean, encoded_var)
            
        return self
        
    def transform(self, X):
        if isinstance(X, pd.DataFrame):
            series = X.iloc[:, 0].astype(str)
        else:
            series = pd.Series(X).astype(str)
            
        means = []
        vars_ = []
        
        for val in series:
            if val in self.encoding_map_:
                m_val, v_val = self.encoding_map_[val]
            else:
                m_val, v_val = self.default_encoding_
            means.append(m_val)
            vars_.append(v_val)
            
        df_out = pd.DataFrame({
            f"{self.column_name_}_BTE_mean": means,
            f"{self.column_name_}_BTE_var": vars_
        }, index=series.index)
        
        return df_out
        
    def fit_transform(self, X, y):
        return self.fit(X, y).transform(X)
