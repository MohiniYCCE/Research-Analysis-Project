import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional


def get_descriptive_stats(df: pd.DataFrame, columns: Optional[List[str]] = None) -> pd.DataFrame:
    """Compute descriptive statistics for numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    if columns:
        numeric_df = numeric_df[[c for c in columns if c in numeric_df.columns]]
    
    if numeric_df.empty:
        return pd.DataFrame()

    desc = numeric_df.describe(percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]).T
    desc["variance"] = numeric_df.var()
    desc["skewness"] = numeric_df.skew()
    desc["kurtosis"] = numeric_df.kurtosis()
    desc["cv"] = (numeric_df.std() / numeric_df.mean() * 100).round(2)
    
    return desc.round(4)


def get_correlation_matrix(df: pd.DataFrame, method: str = "pearson") -> pd.DataFrame:
    """Compute correlation matrix for numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty or len(numeric_df.columns) < 2:
        return pd.DataFrame()
    return numeric_df.corr(method=method).round(4)


def normality_test(df: pd.DataFrame, column: str) -> Dict[str, Any]:
    """Perform Shapiro-Wilk normality test."""
    series = df[column].dropna()
    if len(series) < 3 or len(series) > 5000:
        return {"test": "Shapiro-Wilk", "error": "Requires 3-5000 samples"}
    
    stat, p_value = stats.shapiro(series)
    return {
        "test": "Shapiro-Wilk",
        "statistic": round(float(stat), 6),
        "p_value": round(float(p_value), 6),
        "normal": p_value > 0.05,
    }


def t_test(df: pd.DataFrame, col1: str, col2: str, paired: bool = False) -> Dict[str, Any]:
    """Perform t-test between two columns."""
    x = df[col1].dropna()
    y = df[col2].dropna()
    
    if paired:
        min_len = min(len(x), len(y))
        stat, p = stats.ttest_rel(x[:min_len], y[:min_len])
        test_name = "Paired t-test"
    else:
        stat, p = stats.ttest_ind(x, y)
        test_name = "Independent t-test"
    
    return {
        "test": test_name,
        "statistic": round(float(stat), 6),
        "p_value": round(float(p), 6),
        "significant": p < 0.05,
    }


def chi_square_test(df: pd.DataFrame, col1: str, col2: str) -> Dict[str, Any]:
    """Perform chi-square test of independence."""
    contingency = pd.crosstab(df[col1], df[col2])
    chi2, p, dof, expected = stats.chi2_contingency(contingency)
    return {
        "test": "Chi-square",
        "statistic": round(float(chi2), 6),
        "p_value": round(float(p), 6),
        "degrees_of_freedom": int(dof),
        "significant": p < 0.05,
    }


def anova_test(df: pd.DataFrame, value_col: str, group_col: str) -> Dict[str, Any]:
    """Perform one-way ANOVA."""
    groups = [group.dropna() for _, group in df.groupby(group_col)[value_col]]
    groups = [g for g in groups if len(g) > 0]
    if len(groups) < 2:
        return {"error": "Need at least 2 groups"}
    
    stat, p = stats.f_oneway(*groups)
    return {
        "test": "One-Way ANOVA",
        "statistic": round(float(stat), 6),
        "p_value": round(float(p), 6),
        "significant": p < 0.05,
    }


def get_frequency_table(df: pd.DataFrame, column: str, top_n: int = 20) -> pd.DataFrame:
    """Get frequency table for a categorical column."""
    counts = df[column].value_counts().head(top_n)
    pct = (counts / len(df) * 100).round(2)
    return pd.DataFrame({
        "Value": counts.index,
        "Count": counts.values,
        "Percentage": pct.values,
    })


def descriptive_statistics(df: pd.DataFrame) -> pd.DataFrame:
    return get_descriptive_stats(df)


def build_overall_categorical_table(df: pd.DataFrame) -> pd.DataFrame:
    cat_cols = df.select_dtypes(include=["object", "category"]).columns
    if len(cat_cols) == 0:
        return pd.DataFrame()

    summary_rows = []
    for col in cat_cols:
        counts = df[col].value_counts(dropna=False)
        top = counts.index[0] if len(counts) > 0 else None
        summary_rows.append({
            "column": col,
            "unique_values": int(df[col].nunique(dropna=False)),
            "top_value": top,
            "top_count": int(counts.iloc[0]) if len(counts) > 0 else 0,
        })

    return pd.DataFrame(summary_rows)
