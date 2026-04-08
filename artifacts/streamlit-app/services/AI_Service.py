import pandas as pd
import numpy as np
from typing import Dict, Any, List


def generate_auto_insights(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Generate automatic insights from a DataFrame."""
    insights = []
    numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
    cat_cols = list(df.select_dtypes(include=["object", "category"]).columns)

    # Dataset overview
    insights.append({
        "type": "overview",
        "icon": "chart",
        "title": "Dataset Overview",
        "description": f"Your dataset has {len(df):,} rows and {len(df.columns)} columns. "
                       f"It contains {len(numeric_cols)} numeric and {len(cat_cols)} categorical columns.",
        "severity": "info",
    })

    # Missing values insight
    missing = df.isnull().sum()
    cols_with_missing = missing[missing > 0]
    if len(cols_with_missing) > 0:
        worst_col = cols_with_missing.idxmax()
        worst_pct = round(cols_with_missing.max() / len(df) * 100, 1)
        insights.append({
            "type": "quality",
            "icon": "warning",
            "title": "Missing Values Detected",
            "description": f"{len(cols_with_missing)} column(s) have missing values. "
                           f"'{worst_col}' has the most at {worst_pct}% missing. "
                           "Consider using the Data Cleaning module to handle these.",
            "severity": "warning",
        })
    else:
        insights.append({
            "type": "quality",
            "icon": "check",
            "title": "No Missing Values",
            "description": "Great! Your dataset has no missing values — it is complete and ready for analysis.",
            "severity": "success",
        })

    # Duplicate rows
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        insights.append({
            "type": "quality",
            "icon": "warning",
            "title": f"{dup_count:,} Duplicate Rows Found",
            "description": f"There are {dup_count:,} duplicate rows in your dataset ({round(dup_count/len(df)*100, 1)}%). "
                           "Remove them in the Data Cleaning module for cleaner analysis.",
            "severity": "warning",
        })

    # Skewness insights for numeric columns
    if numeric_cols:
        skewness = df[numeric_cols].skew().abs()
        highly_skewed = skewness[skewness > 2].index.tolist()
        if highly_skewed:
            cols_str = ", ".join(f"'{c}'" for c in highly_skewed[:3])
            insights.append({
                "type": "distribution",
                "icon": "info",
                "title": "Highly Skewed Distributions",
                "description": f"Column(s) {cols_str} have high skewness (>2). "
                               "Consider log-transformation or outlier removal for more accurate statistical tests.",
                "severity": "info",
            })

    # Correlation insights
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr().abs()
        np.fill_diagonal(corr.values, 0)
        max_corr = corr.max().max()
        if max_corr > 0.8:
            idx = corr.stack().idxmax()
            insights.append({
                "type": "correlation",
                "icon": "link",
                "title": "Strong Correlation Detected",
                "description": f"Columns '{idx[0]}' and '{idx[1]}' have a very high correlation of {round(max_corr, 3)}. "
                               "This may indicate multicollinearity — consider removing one for ML models.",
                "severity": "info",
            })

    # Cardinality check
    for col in cat_cols:
        n_unique = df[col].nunique()
        if n_unique > 0.9 * len(df) and len(df) > 100:
            insights.append({
                "type": "cardinality",
                "icon": "info",
                "title": f"High Cardinality: '{col}'",
                "description": f"Column '{col}' has {n_unique:,} unique values (~{round(n_unique/len(df)*100)}% of rows). "
                               "This may be an ID or free-text column — consider excluding it from categorical analysis.",
                "severity": "info",
            })

    # Numeric outlier detection (IQR method)
    for col in numeric_cols[:5]:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        if iqr > 0:
            outliers = df[(df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)]
            if len(outliers) > 0:
                pct = round(len(outliers) / len(df) * 100, 1)
                insights.append({
                    "type": "outlier",
                    "icon": "alert",
                    "title": f"Outliers in '{col}'",
                    "description": f"{len(outliers):,} outliers detected in '{col}' ({pct}% of data using IQR method). "
                                   "Outliers can skew statistics and visualizations.",
                    "severity": "warning",
                })
                break  # Only report one outlier insight to avoid overload

    return insights
