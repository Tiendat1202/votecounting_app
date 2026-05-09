export type ReportTemplateId =
  | "default"
  | "ward_household"
  | "company_2019"
  | "custom";

export type ReportCandidate = {
  name: string;
  agree?: number;
  disagree?: number;
  selected?: number;
  notSelected?: number;
  trustHigh?: number;
  trustMedium?: number;
  trustLow?: number;
  votesReceived?: number;
  percent?: number;
  isElected?: boolean;
  evaluationCounts?: Array<{
    key: string;
    label: string;
    count: number;
    percent: number;
  }>;
};

export type ReportSummary = {
  sessionName: string;
  voteType: "trust" | "surplus";
  voteRule?: string | null;
  electionUnit?: string | null;
  location?: string | null;
  totalBallots: number;
  validBallots: number;
  invalidBallots: number;
  failedBallots: number;
  candidates: ReportCandidate[];
  evaluationOptions?: Array<{ key: string; label: string }>;
};

export type RenderReportInput = {
  templateId?: ReportTemplateId | string;
  customTemplate?: string;
  fields?: Record<string, any>;
  summary: ReportSummary;
};

const nf = new Intl.NumberFormat("vi-VN");

const value = (v: any, fallback = "................................") => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s ? s : fallback;
};

const percent = (count: number | undefined, total: number) => {
  if (!total || total <= 0) return "0.00%";
  return `${(((count || 0) / total) * 100).toFixed(2)}%`;
};

const todayVi = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};

function renderCandidateResults(summary: ReportSummary) {
  const total = summary.validBallots || 0;

  if (summary.voteType === "trust") {
    return summary.candidates
      .map((c, idx) => {
        const counts =
          c.evaluationCounts && c.evaluationCounts.length > 0
            ? c.evaluationCounts
            : (summary.evaluationOptions || []).map((opt) => ({
                ...opt,
                count: 0,
                percent: 0,
              }));
        const lines = counts.map(
          (item) =>
            `   - ${item.label}: ${nf.format(item.count || 0)} phiếu, chiếm ${percent(item.count || 0, total)}`,
        );
        return `${idx + 1}. ${c.name}\n${lines.join("\n")}`;
      })
      .join("\n");
  }

  return summary.candidates
    .map((c, idx) => {
      const selected = c.selected || c.votesReceived || 0;
      const notSelected = c.notSelected || 0;
      return `${idx + 1}. ${c.name}
   - Được bầu: ${nf.format(selected)} phiếu, chiếm ${percent(selected, total)}
   - Bị gạch/không chọn: ${nf.format(notSelected)} phiếu
   - Trạng thái: ${c.isElected ? "Trúng cử" : "Không trúng cử"}`;
    })
    .join("\n");
}

function renderDefault(summary: ReportSummary, fields: Record<string, any>) {
  return `
BIÊN BẢN KIỂM PHIẾU

Đơn vị tổ chức: ${value(fields.electionUnit || summary.electionUnit)}
Địa điểm diễn ra: ${value(fields.location || summary.location)}
Phiên kiểm phiếu: ${summary.sessionName}
Ngày lập biên bản: ${value(fields.reportDate, todayVi())}

I. THÔNG TIN TỔNG HỢP

Tổng số phiếu: ${nf.format(summary.totalBallots)}
Số phiếu hợp lệ: ${nf.format(summary.validBallots)}
Số phiếu không hợp lệ: ${nf.format(summary.invalidBallots)}
Số phiếu đang chờ/lỗi: ${nf.format(summary.failedBallots)}

II. KẾT QUẢ KIỂM PHIẾU

${renderCandidateResults(summary)}

III. XÁC NHẬN

Người lập biên bản: ${value(fields.reportCreator)}
Ghi chú: ${value(fields.notes, "")}
`.trim();
}

function renderWardHousehold(
  summary: ReportSummary,
  fields: Record<string, any>,
) {
  return `
UBND XÃ/PHƯỜNG ${value(fields.ward)}
THÔN, TỔ DÂN PHỐ ${value(fields.hamlet)}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------

${value(fields.placeForDate, "........")}, ngày ${value(fields.day, "...")} tháng ${value(fields.month, "...")} năm ${value(fields.year, "...")}

BIÊN BẢN KIỂM PHIẾU
Về việc ${value(fields.purpose)}

Hôm nay, vào hồi ${value(fields.meetingTime, "... giờ ... phút")}, tại ${value(fields.location || summary.location)},
cộng đồng dân cư tổ chức kiểm phiếu.

Đơn vị tổ chức: ${value(fields.electionUnit || summary.electionUnit)}

Ban kiểm phiếu gồm:
1. Tổ trưởng: ${value(fields.teamLeader)}
2. Thành viên: ${value(fields.members)}

KẾT QUẢ KIỂM PHIẾU

Tổng số phiếu phát ra/ghi nhận: ${nf.format(summary.totalBallots)}
Số phiếu hợp lệ: ${nf.format(summary.validBallots)}
Số phiếu không hợp lệ: ${nf.format(summary.invalidBallots)}
Số phiếu đang chờ/lỗi: ${nf.format(summary.failedBallots)}

Kết quả cụ thể:
${renderCandidateResults(summary)}

Biên bản được lập xong vào hồi ${value(fields.endTime, "... giờ ... phút")} cùng ngày.

ĐẠI DIỆN BAN KIỂM PHIẾU
Tổ trưởng
${value(fields.teamLeader, "")}
`.trim();
}

function renderCompany2019(
  summary: ReportSummary,
  fields: Record<string, any>,
) {
  return `
${value(fields.companyHeader, "CÔNG TY CỔ PHẦN / ĐƠN VỊ TỔ CHỨC")}
${value(fields.companyName || summary.electionUnit)}

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------

BIÊN BẢN KIỂM PHIẾU BIỂU QUYẾT
${value(fields.congressName, "ĐẠI HỘI / HỘI NGHỊ")}
Ngày ${value(fields.reportDate, todayVi())}

Căn cứ:
${value(fields.legalBases, "- Căn cứ quy chế làm việc của đơn vị;\n- Căn cứ chức năng, nhiệm vụ của Ban kiểm phiếu;")}

Hôm nay, tại ${value(fields.location || summary.location)}, Ban kiểm phiếu tiến hành kiểm phiếu.

Ban kiểm phiếu gồm:
${value(fields.voteCountingBoard)}

I. THÔNG TIN TỔNG HỢP

Tổng số phiếu: ${nf.format(summary.totalBallots)}
Số phiếu hợp lệ: ${nf.format(summary.validBallots)}
Số phiếu không hợp lệ: ${nf.format(summary.invalidBallots)}
Số phiếu đang chờ/lỗi: ${nf.format(summary.failedBallots)}

II. KẾT QUẢ KIỂM PHIẾU

${renderCandidateResults(summary)}

Biên bản này được lập thành văn bản để báo cáo và lưu hồ sơ.

TRƯỞNG BAN KIỂM PHIẾU
${value(fields.chiefName, "")}
`.trim();
}

function renderCustom(
  template: string,
  summary: ReportSummary,
  fields: Record<string, any>,
) {
  const map: Record<string, any> = {
    sessionName: summary.sessionName,
    electionUnit: fields.electionUnit || summary.electionUnit || "",
    location: fields.location || summary.location || "",
    totalBallots: nf.format(summary.totalBallots),
    validBallots: nf.format(summary.validBallots),
    invalidBallots: nf.format(summary.invalidBallots),
    failedBallots: nf.format(summary.failedBallots),
    candidateResults: renderCandidateResults(summary),
    reportDate: fields.reportDate || todayVi(),
    voteType:
      summary.voteType === "trust" ? "Phiếu tín nhiệm" : "Phiếu có số dư",
    voteRule:
      summary.voteType === "trust"
        ? (summary.evaluationOptions || [])
            .map((item) => item.label)
            .join(" / ") || "Tự nhập cách đánh giá"
        : "Bầu theo số lượng cần bầu",
    ...fields,
  };

  return String(template || "")
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const replacement = map[key];
      return replacement === undefined || replacement === null
        ? ""
        : String(replacement);
    })
    .trim();
}

export function renderReport(input: RenderReportInput) {
  const templateId = input.templateId || "default";
  const fields = input.fields || {};

  if (templateId === "ward_household")
    return renderWardHousehold(input.summary, fields);
  if (templateId === "company_2019")
    return renderCompany2019(input.summary, fields);
  if (templateId === "custom")
    return renderCustom(input.customTemplate || "", input.summary, fields);
  return renderDefault(input.summary, fields);
}

export function safeReportFileName(name: string) {
  const normalized = String(name || "bien-ban-kiem-phieu")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\w\d-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return normalized || "bien-ban-kiem-phieu";
}
