export type ReportTabExportApi = {
  exportPdf: () => void | Promise<void>;
  exporting: boolean;
  canExport: boolean;
};

export type ReportTabExportProps = {
  onExportReady?: (api: ReportTabExportApi) => void;
};
