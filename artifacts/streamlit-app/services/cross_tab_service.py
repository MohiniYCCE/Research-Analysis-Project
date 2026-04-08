import pandas as pd
import numpy as np

from scipy.stats import chi2_contingency, pearsonr, ttest_ind, f_oneway

def cross_tab_analysis(df, row, col):

    row_is_numeric = pd.api.types.is_numeric_dtype(df[row])
    col_is_numeric = pd.api.types.is_numeric_dtype(df[col])

    results = {}

    if not row_is_numeric and not col_is_numeric:

        counts = pd.crosstab(df[row], df[col])

        chi2, p, dof, _ = chi2_contingency(counts)

        results["type"] = "categorical"
        results["counts"] = counts
        results["p_value"] = p

    elif row_is_numeric and col_is_numeric:

        data = df[[row,col]].dropna()

        r,p = pearsonr(data[row],data[col])

        results["type"] = "numeric"
        results["correlation"] = r
        results["p_value"] = p

    else:

        if row_is_numeric:
            numeric_var=row
            group_var=col
        else:
            numeric_var=col
            group_var=row

        data=df[[numeric_var,group_var]].dropna()

        groups=data[group_var].unique()

        if len(groups)==2:

            g1=data[data[group_var]==groups[0]][numeric_var]
            g2=data[data[group_var]==groups[1]][numeric_var]

            t,p=ttest_ind(g1,g2)

            results["type"]="t-test"
            results["p_value"]=p

        else:

            samples=[
                data[data[group_var]==g][numeric_var]
                for g in groups
            ]

            f,p=f_oneway(*samples)

            results["type"]="anova"
            results["p_value"]=p

    return results