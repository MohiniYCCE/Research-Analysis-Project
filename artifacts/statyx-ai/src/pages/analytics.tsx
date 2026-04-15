import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, UploadCloud, Wand2, BarChart3, LineChart, BrainCircuit, Network, FileText, DownloadCloud, CheckCircle2, MessageSquare } from "lucide-react";
import {
  uploadDataset,
  detectCleaningIssues,
  applyCleaning,
  fetchStatsSummary,
  generateVisualization,
  runAiInsights,
  runCrossTab,
  generateReport,
  submitFeedback,
  DatasetRow,
} from "@/lib/python-api";

const CHART_TYPES = [
  { value: "histogram", label: "Histogram" },
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
  { value: "boxplot", label: "Box Plot" },
  { value: "pie", label: "Pie" },
];

const TABS: Record<string, { title: string; description: string }> = {
  upload: { title: "Upload Data", description: "Start by uploading your dataset so the Python analytics backend can process it." },
  clean: { title: "Data Cleaning", description: "Detect missing values, duplicate rows, and apply smart cleaning strategies." },
  statistics: { title: "Statistics", description: "Produce descriptive summaries and category-level statistics from your dataset." },
  visualizations: { title: "Visualizations", description: "Render charts and plots from the dataset using backend Python logic." },
  "ai-analysis": { title: "AI Analysis", description: "Ask the AI engine for smart test recommendations and model-driven insights." },
  "cross-tabulation": { title: "Cross Tabulation", description: "Explore relationships between categorical variables with cross-tab analysis." },
  reports: { title: "Reports", description: "Export PDF or Word reports built from the current dataset and generated insights." },
};

function renderTable(rows: DatasetRow[], columns: string[]) {
  if (!rows.length || !columns.length) {
    return <div className="text-sm text-muted-foreground">No preview available.</div>;
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-background">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 uppercase tracking-wide text-xs font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-card" : "bg-background"}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top text-sm text-foreground">
                  {String(row[column] ?? "").slice(0, 80)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState<string>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [datasetRows, setDatasetRows] = useState<DatasetRow[]>([]);
  const [datasetColumns, setDatasetColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<DatasetRow[]>([]);
  const [fileInfo, setFileInfo] = useState<{ rowCount: number; columnCount: number; info: any } | null>(null);

  const [cleanIssues, setCleanIssues] = useState<any[]>([]);
  const [cleanActions, setCleanActions] = useState<Record<string, any>>({});
  const [cleanPreview, setCleanPreview] = useState<DatasetRow[]>([]);

  const [statsResult, setStatsResult] = useState<{ descriptive: any[]; categorical: any[] } | null>(null);
  const [visualizationImage, setVisualizationImage] = useState<string | null>(null);
  const [chartType, setChartType] = useState<string>(CHART_TYPES[0].value);
  const [visualizationColumns, setVisualizationColumns] = useState<string[]>([]);

  const [objective, setObjective] = useState<string>("");
  const [aiResult, setAiResult] = useState<{ insights: any[]; tests: any[] } | null>(null);

  const [crossRow, setCrossRow] = useState<string>("");
  const [crossCol, setCrossCol] = useState<string>("");
  const [crossResult, setCrossResult] = useState<any | null>(null);

  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentPage = searchParams.get("page") || "upload";
    setPage(currentPage);
  }, [window.location.search]);

  useEffect(() => {
    if (datasetColumns.length > 0 && visualizationColumns.length === 0) {
      setVisualizationColumns([datasetColumns[0]]);
    }
  }, [datasetColumns, visualizationColumns.length]);

  const datasetLoaded = datasetRows.length > 0;
  const moduleTitle = TABS[page]?.title ?? "Upload Data";
  const moduleDescription = TABS[page]?.description ?? "Work with your dataset using backend Python logic.";

  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await uploadDataset(file);
      setDatasetRows(result.rows);
      setPreviewRows(result.preview);
      setDatasetColumns(result.columns);
      setFileInfo({ rowCount: result.rowCount, columnCount: result.columnCount, info: result.info });
      setSuccess("Dataset uploaded successfully.");
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDetectIssues = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await detectCleaningIssues(datasetRows);
      setCleanIssues(result.issues);
      setPreviewRows(result.preview);
      setSuccess("Cleaning issues detected.");
    } catch (err: any) {
      setError(err.message || "Could not detect issues.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCleaning = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const actions = cleanIssues.map((issue) => {
        if (issue.column === "__duplicates__") {
          return {
            column: issue.column,
            method: "remove",
            custom: null,
            drop_column: false,
          };
        }

        return {
          column: issue.column,
          method: cleanActions[issue.column] || (issue.dtype === "numeric" ? "mean" : "mode"),
          custom: cleanActions[issue.column + "_custom"],
          drop_column: false,
        };
      });

      const result = await applyCleaning(datasetRows, actions);
      const rows = result.preview;
      setDatasetRows(rows.length > 0 ? rows : datasetRows);
      setCleanPreview(rows);
      setPreviewRows(rows);
      setSuccess("Cleaning applied successfully.");
    } catch (err: any) {
      setError(err.message || "Unable to apply cleaning.");
    } finally {
      setLoading(false);
    }
  };

  const handleComputeStatistics = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await fetchStatsSummary(datasetRows);
      setStatsResult({ descriptive: result.descriptive, categorical: result.categorical });
      setSuccess("Statistics generated.");
    } catch (err: any) {
      setError(err.message || "Statistics generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVisualization = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }

    if (!visualizationColumns.length) {
      setError("Select at least one column for visualization.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await generateVisualization(datasetRows, chartType, visualizationColumns);
      setVisualizationImage(result.imageBase64);
      setSuccess("Visualization generated.");
    } catch (err: any) {
      setError(err.message || "Visualization failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }
    if (!objective.trim()) {
      setError("Enter an objective for AI analysis.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await runAiInsights(datasetRows, objective);
      setAiResult({ insights: result.insights, tests: result.tests });
      setSuccess("AI analysis completed.");
    } catch (err: any) {
      setError(err.message || "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCrossTab = async () => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }
    if (!crossRow || !crossCol) {
      setError("Select both row and column fields.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await runCrossTab(datasetRows, crossRow, crossCol);
      setCrossResult(result.result);
      setSuccess("Cross-tabulation completed.");
    } catch (err: any) {
      setError(err.message || "Cross-tabulation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (format: "pdf" | "docx") => {
    if (!datasetLoaded) {
      setError("Upload a dataset first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await generateReport(datasetRows, format, "statyx-report", aiResult?.insights ?? []);
      const blob = new Blob([Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0))], { type: result.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setReportStatus(`${format.toUpperCase()} report downloaded.`);
    } catch (err: any) {
      setError(err.message || "Report generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setError(null);
    setSuccess(null);
    try {
      const result = await submitFeedback("Feature request or feedback submitted.");
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message || "Feedback submission failed.");
    }
  };

  const moduleContent = useMemo(() => {
    switch (page) {
      case "upload":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Upload dataset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload a CSV or Excel file to start the analysis workflow.</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                {fileInfo && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-4 bg-card">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Rows</p>
                      <p className="mt-2 text-2xl font-semibold">{fileInfo.rowCount}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4 bg-card">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Columns</p>
                      <p className="mt-2 text-2xl font-semibold">{fileInfo.columnCount}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4 bg-card">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Duplicate rows</p>
                      <p className="mt-2 text-2xl font-semibold">{fileInfo.info.duplicateCount}</p>
                    </div>
                  </div>
                )}
                {previewRows.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Preview</h3>
                    {renderTable(previewRows, datasetColumns)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "clean":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Data Cleaning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload a dataset first to access cleaning tools.</p>
                ) : (
                  <>
                    <Button onClick={handleDetectIssues} disabled={loading}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Detect Issues
                    </Button>
                    {cleanIssues.length > 0 && (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {cleanIssues.map((issue) => (
                            <div key={issue.column} className="rounded-xl border border-border p-4 bg-card">
                              <h4 className="font-medium">{issue.issue === "Duplicate rows" ? "Duplicate rows" : issue.column}</h4>
                              <p className="text-sm text-muted-foreground">{issue.issue}</p>
                              {issue.issue !== "Duplicate rows" && (
                                <div className="mt-3 space-y-2">
                                  <label className="block text-sm font-medium">Fix method</label>
                                  <select
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    value={cleanActions[issue.column] || (issue.dtype === "numeric" ? "mean" : "mode")}
                                    onChange={(event) => setCleanActions((prev) => ({ ...prev, [issue.column]: event.target.value }))}
                                  >
                                    {issue.dtype === "numeric" ? (
                                      <> 
                                        <option value="mean">Fill with mean</option>
                                        <option value="median">Fill with median</option>
                                        <option value="zero">Fill with zero</option>
                                        <option value="custom">Custom value</option>
                                      </>
                                    ) : (
                                      <>
                                        <option value="mode">Fill with mode</option>
                                        <option value="custom">Fill with custom</option>
                                      </>
                                    )}
                                  </select>
                                  {cleanActions[issue.column] === "custom" && (
                                    <Input
                                      placeholder="Custom fill value"
                                      value={cleanActions[issue.column + "_custom"] || ""}
                                      onChange={(event) => setCleanActions((prev) => ({
                                        ...prev,
                                        [issue.column + "_custom"]: event.target.value,
                                      }))}
                                    />
                                  )}
                                </div>
                              )}
                              {issue.issue === "Duplicate rows" && (
                                <p className="mt-3 text-sm text-muted-foreground">This dataset contains duplicate rows that can be removed.</p>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button onClick={handleApplyCleaning} disabled={loading}>
                          <Wand2 className="mr-2 h-4 w-4" /> Apply Cleaning
                        </Button>
                      </div>
                    )}
                    {cleanPreview.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Cleaned preview</h3>
                        {renderTable(cleanPreview, datasetColumns)}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "statistics":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload your dataset and then generate statistics.</p>
                ) : (
                  <>
                    <Button onClick={handleComputeStatistics} disabled={loading}>
                      <BarChart3 className="mr-2 h-4 w-4" /> Generate Summary
                    </Button>
                    {statsResult && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold">Numerical summary</h3>
                          {renderTable(statsResult.descriptive, Object.keys(statsResult.descriptive[0] || {}))}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Categorical overview</h3>
                          {renderTable(statsResult.categorical, Object.keys(statsResult.categorical[0] || {}))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "visualizations":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Visualizations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload your dataset before generating charts.</p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">Chart type</label>
                        <select
                          value={chartType}
                          onChange={(event) => setChartType(event.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          {CHART_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Columns</label>
                        <select
                          multiple
                          size={3}
                          value={visualizationColumns}
                          onChange={(event) => setVisualizationColumns(Array.from(event.target.selectedOptions, (option) => option.value))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          {datasetColumns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button onClick={handleGenerateVisualization} disabled={loading}>
                      <LineChart className="mr-2 h-4 w-4" /> Generate Chart
                    </Button>
                    {visualizationImage && (
                      <div className="rounded-xl border border-border overflow-hidden bg-card">
                        <img src={`data:image/png;base64,${visualizationImage}`} alt="Visualization" className="w-full" />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "ai-analysis":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload a dataset and provide an objective to run the AI engine.</p>
                ) : (
                  <>
                    <Textarea
                      value={objective}
                      onChange={(event) => setObjective(event.target.value)}
                      placeholder="Describe your analysis objective, e.g. 'Compare sales across regions.'"
                      className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <Button onClick={handleRunAiAnalysis} disabled={loading}>
                      <BrainCircuit className="mr-2 h-4 w-4" /> Run AI Analysis
                    </Button>
                    {aiResult && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <h3 className="text-lg font-semibold">AI insights</h3>
                          <ul className="mt-3 space-y-3">
                            {aiResult.insights.map((insight, index) => (
                              <li key={index} className="rounded-lg bg-background p-3">
                                <strong>{insight.title}</strong>
                                <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4">
                          <h3 className="text-lg font-semibold">Suggested tests</h3>
                          <ul className="mt-3 space-y-3">
                            {aiResult.tests.map((test, index) => (
                              <li key={index} className="rounded-lg bg-background p-3">
                                <strong>{test.test}</strong>
                                <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(test.result, null, 2)}</pre>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "cross-tabulation":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Cross Tabulation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload a dataset and choose categorical columns.</p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Row variable</label>
                        <select
                          value={crossRow}
                          onChange={(event) => setCrossRow(event.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select row field</option>
                          {datasetColumns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Column variable</label>
                        <select
                          value={crossCol}
                          onChange={(event) => setCrossCol(event.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select column field</option>
                          {datasetColumns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button onClick={handleCrossTab} disabled={loading}>
                      <Network className="mr-2 h-4 w-4" /> Run Cross Tab
                    </Button>
                    {crossResult && (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="text-lg font-semibold">Result</h3>
                        <pre className="mt-3 overflow-x-auto text-sm text-muted-foreground">{JSON.stringify(crossResult, null, 2)}</pre>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "reports":
        return (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!datasetLoaded ? (
                  <p className="text-sm text-muted-foreground">Upload data and run analysis before exporting reports.</p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Button onClick={() => handleGenerateReport("pdf")} disabled={loading}>
                        <DownloadCloud className="mr-2 h-4 w-4" /> Download PDF
                      </Button>
                      <Button onClick={() => handleGenerateReport("docx")} disabled={loading}>
                        <FileText className="mr-2 h-4 w-4" /> Download Word
                      </Button>
                    </div>
                    {reportStatus && <div className="text-sm text-muted-foreground">{reportStatus}</div>}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div>Unknown section.</div>;
    }
  }, [page, datasetLoaded, datasetColumns, previewRows, cleanIssues, cleanPreview, statsResult, visualizationImage, objective, aiResult, crossResult, reportStatus, loading, cleanActions]);

  return (
    <div className="flex-1 px-6 py-8 md:px-8 md:py-10 space-y-6 bg-background">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Analytics</p>
            <h1 className="text-3xl font-bold tracking-tight">{moduleTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{moduleDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(TABS).map((tab) => (
              <Button
                key={tab}
                variant={tab === page ? "secondary" : "ghost"}
                onClick={() => setLocation(`/dashboard/analytics?page=${tab}`)}
                size="sm"
              >
                {TABS[tab].title}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          moduleContent
        )}
      </div>
    </div>
  );
}
