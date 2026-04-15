import base64
import io
from typing import Any, Dict, List, Optional, TypedDict

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from scipy import stats
from sentence_transformers import SentenceTransformer

from services.Cleaning_Service import apply_cleaning_pipeline, detect_issues
from services.Statistics_Service import (
    descriptive_statistics,
    build_overall_categorical_table,
)
from services.AI_Service import generate_auto_insights
from services.Report_Service import generate_pdf_report, generate_word_report
from services.cross_tab_service import cross_tab_analysis
from services.visualization_service import generate_plot
from utils.Dataframe_Utils import load_dataframe

MODEL = SentenceTransformer("intfloat/e5-base")
TEST_DESCRIPTIONS = {
    "independent_t_test": "compare mean of a continuous variable between two independent groups",
    "anova": "compare mean across more than two groups",
    "chi_square": "association between two categorical variables",
    "pearson_correlation": "linear correlation between two numeric variables",
}
TEST_NAMES = list(TEST_DESCRIPTIONS.keys())
TEST_TEXTS = [f"passage: {desc}" for desc in TEST_DESCRIPTIONS.values()]
TEST_EMBEDDINGS = MODEL.encode(TEST_TEXTS, convert_to_numpy=True)

app = FastAPI(title="Statyx Python Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


class DatasetPayload(BaseModel):
    rows: List[Dict[str, Any]]


class CleanAction(BaseModel):
    column: str
    method: str
    custom: Optional[str] = None
    keep: Optional[str] = None
    dup_subset: Optional[List[str]] = None
    drop_column: Optional[bool] = False


class CleanRequest(DatasetPayload):
    actions: List[CleanAction]


class AiRequest(DatasetPayload):
    objective: Optional[str] = None


class VisualizationRequest(DatasetPayload):
    chartType: str
    columns: List[str]
    options: Optional[Dict[str, Any]] = None


class CrossTabRequest(DatasetPayload):
    row: str
    col: str


class ReportRequest(DatasetPayload):
    format: str
    fileName: Optional[str] = "dataset"
    insights: Optional[List[Dict[str, Any]]] = None


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = df.columns.map(lambda c: str(c).strip().lower())
    return df


def df_preview(df: pd.DataFrame, rows: int = 10) -> List[Dict[str, Any]]:
    return df.head(rows).replace({np.nan: None}).to_dict(orient="records")


def encode_png(fig) -> str:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def compute_objective_tests(df: pd.DataFrame, objective: str) -> List[Dict[str, Any]]:
    objective_embedding = MODEL.encode([f"passage: {objective}"], convert_to_numpy=True)[0]
    scores = [
        (name, float(np.dot(objective_embedding, TEST_EMBEDDINGS[i]) /
                        (np.linalg.norm(objective_embedding) * np.linalg.norm(TEST_EMBEDDINGS[i]) + 1e-9)))
        for i, name in enumerate(TEST_NAMES)
    ]
    scores.sort(key=lambda item: item[1], reverse=True)

    results = []
    numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
    cat_cols = list(df.select_dtypes(include=["object", "category"]).columns)

    def add_result(name: str, result: Dict[str, Any]):
        results.append({"test": name, "result": result})

    for name, _score in scores[:2]:
        if name == "pearson_correlation" and len(numeric_cols) >= 2:
            x = df[numeric_cols[0]].dropna()
            y = df[numeric_cols[1]].dropna()
            if len(x) > 1 and len(y) > 1:
                stat, p = stats.pearsonr(x, y)
                add_result("Pearson correlation", {"correlation": round(float(stat), 4), "p_value": round(float(p), 6)})
        elif name == "chi_square" and len(cat_cols) >= 2:
            contingency = pd.crosstab(df[cat_cols[0]], df[cat_cols[1]])
            if contingency.shape[0] >= 2 and contingency.shape[1] >= 2:
                chi2, p, _, _ = stats.chi2_contingency(contingency)
                add_result("Chi-square", {"chi2": round(float(chi2), 4), "p_value": round(float(p), 6)})
        elif name in ("independent_t_test", "anova") and len(numeric_cols) >= 1 and len(cat_cols) >= 1:
            groups = df[[numeric_cols[0], cat_cols[0]]].dropna().groupby(cat_cols[0])[numeric_cols[0]]
            if len(groups) >= 2:
                samples = [group.values for _, group in groups]
                if name == "independent_t_test" and len(samples) == 2:
                    stat, p = stats.ttest_ind(samples[0], samples[1], equal_var=False)
                    add_result("Independent t-test", {"statistic": round(float(stat), 6), "p_value": round(float(p), 6)})
                elif name == "anova":
                    stat, p = stats.f_oneway(*samples)
                    add_result("One-way ANOVA", {"statistic": round(float(stat), 6), "p_value": round(float(p), 6)})

    if not results:
        results.append({
            "test": "No suitable test found",
            "result": {"error": "Unable to infer an analysis from the current dataset."},
        })

    return results


@app.post("/api/python/upload")
async def upload_dataset(file: UploadFile = File(...)) -> JSONResponse:
    content = await file.read()
    df = load_dataframe(io.BytesIO(content), file.filename)
    if df is None:
        raise HTTPException(status_code=400, detail="Unable to parse uploaded file. Use CSV or Excel.")

    df = normalize_dataframe(df)
    return JSONResponse(
        content=jsonable_encoder({
            "preview": df_preview(df),
            "rows": df.replace({np.nan: None}).to_dict(orient="records"),
            "columns": list(df.columns),
            "rowCount": len(df),
            "columnCount": len(df.columns),
            "info": {
                "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "missing": df.isnull().sum().to_dict(),
                "duplicateCount": int(df.duplicated().sum()),
            },
        })
    )


@app.post("/api/python/clean/detect")
def detect_cleaning(request: DatasetPayload) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    issues = detect_issues(df)
    return JSONResponse(content=jsonable_encoder({"issues": issues, "preview": df_preview(df), "columns": list(df.columns)}))


@app.post("/api/python/clean/apply")
def apply_cleaning(request: CleanRequest) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    for action in request.actions:
        if action.column == "__duplicates__":
            continue
        if action.drop_column:
            df = df.drop(columns=[action.column], errors="ignore")
            continue
        if action.method == "mean" and pd.api.types.is_numeric_dtype(df[action.column]):
            df[action.column] = df[action.column].fillna(df[action.column].mean())
        elif action.method == "median" and pd.api.types.is_numeric_dtype(df[action.column]):
            df[action.column] = df[action.column].fillna(df[action.column].median())
        elif action.method == "mode":
            mode_val = df[action.column].mode()
            if len(mode_val) > 0:
                df[action.column] = df[action.column].fillna(mode_val[0])
        elif action.method == "zero":
            df[action.column] = df[action.column].fillna(0)
        elif action.method == "custom" and action.custom is not None:
            df[action.column] = df[action.column].fillna(action.custom)

    if any(action.column == "__duplicates__" for action in request.actions):
        df = df.drop_duplicates()

    preview = df_preview(df)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    return JSONResponse(
        content=jsonable_encoder({
            "preview": preview,
            "cleanedCsv": base64.b64encode(csv_buffer.getvalue().encode("utf-8")).decode("utf-8"),
            "columns": list(df.columns),
        })
    )


@app.post("/api/python/stats/summary")
def stats_summary(request: DatasetPayload) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    descriptive = descriptive_statistics(df)
    categorical = build_overall_categorical_table(df)
    return JSONResponse(
        content=jsonable_encoder({
            "descriptive": descriptive.reset_index().to_dict(orient="records"),
            "categorical": categorical.to_dict(orient="records"),
            "preview": df_preview(df),
            "columns": list(df.columns),
        })
    )


@app.post("/api/python/visualization")
def visualization(request: VisualizationRequest) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    if not request.columns or len(request.columns) == 0:
        raise HTTPException(status_code=400, detail="At least one column is required for visualization.")

    fig = generate_plot(df, request.chartType, request.columns)
    img_base64 = encode_png(fig)
    return JSONResponse(content=jsonable_encoder({"imageBase64": img_base64}))


@app.post("/api/python/ai/insights")
def ai_insights(request: AiRequest) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    insights = generate_auto_insights(df)
    objective = request.objective or ""
    tests = compute_objective_tests(df, objective) if objective else []
    return JSONResponse(content=jsonable_encoder({"insights": insights, "tests": tests, "columns": list(df.columns)}))


@app.post("/api/python/cross-tab")
def cross_tab(request: CrossTabRequest) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    result = cross_tab_analysis(df, request.row, request.col)
    if isinstance(result.get("counts"), (pd.DataFrame, pd.Series)):
        counts = result["counts"].reset_index().fillna("").to_dict(orient="records")
    else:
        counts = result.get("counts")
    return JSONResponse(content=jsonable_encoder({"result": {**result, "counts": counts}}))


@app.post("/api/python/report")
def report(request: ReportRequest) -> JSONResponse:
    df = normalize_dataframe(pd.DataFrame(request.rows))
    filename = request.fileName or "dataset"
    if request.format.lower() == "pdf":
        content = generate_pdf_report(df, filename, request.insights or [])
        content_type = "application/pdf"
        extension = "pdf"
    else:
        content = generate_word_report(df, filename, request.insights or [])
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        extension = "docx"

    if not content:
        raise HTTPException(status_code=500, detail="Report generation failed.")

    return JSONResponse(
        content=jsonable_encoder({
            "fileName": f"{filename}.{extension}",
            "contentBase64": base64.b64encode(content).decode("utf-8"),
            "contentType": content_type,
        })
    )


@app.post("/api/python/feedback")
def feedback(request: BaseModel) -> JSONResponse:
    return JSONResponse(content={"success": True, "message": "Thanks for your feedback."})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8502)
