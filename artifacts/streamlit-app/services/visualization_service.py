import matplotlib.pyplot as plt
import pandas as pd

def generate_plot(df, plot_type, cols):

    fig, ax = plt.subplots()

    if plot_type == "histogram":
        df[cols[0]].dropna().plot.hist(ax=ax)

    elif plot_type == "boxplot":
        df.boxplot(column=cols[0], ax=ax)

    elif plot_type == "scatter":
        df.plot.scatter(cols[0], cols[1], ax=ax)

    elif plot_type == "line":
        df.plot(x=cols[0], y=cols[1], ax=ax)

    elif plot_type == "bar":
        df.groupby(cols[0])[cols[1]].mean().plot.bar(ax=ax)

    elif plot_type == "pie":
        df[cols[0]].value_counts().plot.pie(ax=ax, autopct="%1.1f%%")

    return fig