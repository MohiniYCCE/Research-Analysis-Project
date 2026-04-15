import pandas as pd
import numpy as np
from utils.Dataframe_Utils import (
    handle_missing_values,
    remove_duplicates,
    convert_column_types,
)
from typing import List, Optional, Tuple, Dict, Any


def apply_cleaning_pipeline(
    df: pd.DataFrame,
    missing_strategy: Optional[str] = None,
    missing_cols: Optional[List[str]] = None,
    remove_dups: bool = False,
    dup_subset: Optional[List[str]] = None,
    type_conversions: Optional[dict] = None,
    drop_cols: Optional[List[str]] = None,
) -> tuple[pd.DataFrame, dict]:
    """Apply a full cleaning pipeline and return cleaned df + a summary."""
    original_shape = df.shape
    summary = {}

    if drop_cols:
        df = df.drop(columns=[c for c in drop_cols if c in df.columns])
        summary["dropped_columns"] = len(drop_cols)

    if missing_strategy and missing_strategy != "None":
        df = handle_missing_values(df, missing_strategy, missing_cols)
        summary["missing_handling"] = missing_strategy

    dups_removed = 0
    if remove_dups:
        df, dups_removed = remove_duplicates(df, subset=dup_subset)
        summary["duplicates_removed"] = dups_removed

    if type_conversions:
        df = convert_column_types(df, type_conversions)
        summary["type_conversions"] = len(type_conversions)

    summary["rows_before"] = original_shape[0]
    summary["rows_after"] = len(df)
    summary["rows_removed"] = original_shape[0] - len(df)
    summary["columns_before"] = original_shape[1]
    summary["columns_after"] = len(df.columns)

    return df, summary


def detect_issues(df: pd.DataFrame) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    for col in df.columns:
        missing = int(df[col].isnull().sum())
        dtype = "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "categorical"
        if missing > 0:
            issues.append({
                "column": col,
                "dtype": dtype,
                "issue": "Missing values",
                "count": missing,
                "recommended": "Fill missing values or drop rows",
            })

    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        issues.append({
            "column": "__duplicates__",
            "dtype": "duplicate",
            "issue": "Duplicate rows",
            "count": dup_count,
            "recommended": "Remove duplicate rows",
        })

    return issues


def is_numeric_like(value: Any) -> bool:
    if value is None:
        return False
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False
