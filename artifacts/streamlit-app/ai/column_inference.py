from sentence_transformers import util
from ai.embedding_model import model

def infer_columns_from_objective(df, objective):

    col_names = df.columns.tolist()

    col_embs = model.encode(
        [f"column: {c}" for c in col_names],
        convert_to_tensor=True
    )

    query_emb = model.encode(
        f"query: {objective}",
        convert_to_tensor=True
    )

    scores = util.cos_sim(query_emb, col_embs)[0]

    ranked = sorted(
        zip(col_names, scores.tolist()),
        key=lambda x: x[1],
        reverse=True
    )

    target_col, group_col = None, None

    for col,_ in ranked:

        if target_col is None and df[col].nunique() == 2:
            target_col = col

        elif group_col is None and df[col].nunique() < 10:
            group_col = col

    return target_col, group_col