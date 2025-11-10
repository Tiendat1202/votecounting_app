import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import "./Results.css";
import ResultAssistant from "../components/ResultAssistant";


interface Candidate {
  name: string;
  validVotes: number;    // tổng phiếu hợp lệ (toàn cuộc)
  invalidVotes: number;  // tổng phiếu không hợp lệ (toàn cuộc)
  votesReceived: number; // phiếu bầu cho ứng viên
  isElected: boolean;
}

const nf = new Intl.NumberFormat("vi-VN");

function truncateName(name: string, max = 14) {
  if (!name) return "";
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

const Results: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalValid, setTotalValid] = useState<number>(0);
  const [totalInvalid, setTotalInvalid] = useState<number>(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const binaryStr = event.target?.result;
      const workbook = XLSX.read(binaryStr as string, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const processed = processElectionResults(data as any[]);
      setCandidates(processed.candidates);
      setTotalValid(processed.totalValid);
      setTotalInvalid(processed.totalInvalid);
    };
    reader.readAsBinaryString(file);
  };

  // Parse Excel: Họ và tên | Phiếu hợp lệ (tổng) | Phiếu không hợp lệ (tổng) | Phiếu bầu
  const processElectionResults = (rows: any[]) => {
    const body = rows.slice(1).filter((r) => Array.isArray(r) && r.length >= 4);

    let maxValid = 0;
    let maxInvalid = 0;

    const parsed: Candidate[] = body.map((row: any[]) => {
      const [rawName, validVotes, invalidVotes, votesReceived] = row;
      const name = String(rawName ?? "").trim();
      const vv = Number(validVotes) || 0;
      const iv = Number(invalidVotes) || 0;
      const vr = Number(votesReceived) || 0;

      if (vv > maxValid) maxValid = vv;
      if (iv > maxInvalid) maxInvalid = iv;

      return {
        name,
        validVotes: vv,
        invalidVotes: iv,
        votesReceived: vr,
        isElected: vv > 0 && vr / vv > 0.5,
      };
    });

    const totalValid = maxValid;
    const totalInvalid = maxInvalid;

    const sorted = parsed.sort((a, b) => b.votesReceived - a.votesReceived);

    const normalized = sorted.map((c) => ({
      ...c,
      validVotes: totalValid,
      invalidVotes: totalInvalid,
    }));

    return { candidates: normalized, totalValid, totalInvalid };
  };

  const totalVotes = totalValid + totalInvalid;

  return (
    <div className="results-container">
      <h1 className="results-title">Kết quả bầu cử</h1>

      <section className="results-actions" aria-label="Tải dữ liệu kết quả">
        <label htmlFor="fileUpload" className="upload-label">
          <span>Chọn tệp Excel</span>
          <input
            id="fileUpload"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={handleFileUpload}
          />
        </label>
        <p className="helper-text">
          Định dạng cột: Họ và tên | Phiếu hợp lệ (tổng) | Phiếu không hợp lệ (tổng) | Phiếu bầu
        </p>
      </section>

      {/* 3 card thống kê */}
      <section className="stats-cards" aria-label="Thống kê tổng quan">
        <div className="stat-card">
          <h3>Tổng số phiếu</h3>
          <p>{nf.format(totalVotes)}</p>
        </div>
        <div className="stat-card">
          <h3>Phiếu hợp lệ</h3>
          <p>{nf.format(totalValid)}</p>
        </div>
        <div className="stat-card">
          <h3>Phiếu không hợp lệ</h3>
          <p>{nf.format(totalInvalid)}</p>
        </div>
      </section>

            {/* 2 card tỉ lệ hợp lệ/không hợp lệ */}
      <section className="ratio-cards" aria-label="Tỉ lệ hợp lệ">
        <div className="ratio-card valid">
          <h3>Tỉ lệ phiếu hợp lệ</h3>
          <p>
            {totalVotes > 0
              ? ((totalValid / totalVotes) * 100).toFixed(2) + "%"
              : "0.00%"}
          </p>
        </div>
        <div className="ratio-card invalid">
          <h3>Tỉ lệ phiếu không hợp lệ</h3>
          <p>
            {totalVotes > 0
              ? ((totalInvalid / totalVotes) * 100).toFixed(2) + "%"
              : "0.00%"}
          </p>
        </div>
      </section>

      {/* Bảng + Biểu đồ */}
      {candidates.length > 0 && (
        <>
          <section aria-label="Bảng kết quả">
            <div className="table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Họ và tên</th>
                    <th>Số phiếu bầu</th>
                    <th>Tỉ lệ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, idx) => {
                    const rate =
                      totalValid > 0
                        ? ((c.votesReceived / totalValid) * 100).toFixed(2)
                        : "0.00";
                    return (
                      <tr key={idx} className={c.isElected ? "" : "not-winner"}>
                        <td>{idx + 1}</td>
                        <td>{c.name}</td>
                        <td>{nf.format(c.votesReceived)}</td>
                        <td>{rate}%</td>
                        <td>{c.isElected ? "Trúng cử" : "Không trúng cử"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Legend thủ công */}
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch--elected" />
              Trúng cử
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch--not" />
              Không trúng cử
            </span>
          </div>

          {/* Biểu đồ */}
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              data={candidates}
              margin={{ top: 12, right: 16, bottom: 70, left: 8 }}
              barCategoryGap={18}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={64}
                tickFormatter={(v) => truncateName(String(v), 14)}
                tick={{ fontSize: 12, fill: "#334155" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#334155" }}
                tickFormatter={(v) => nf.format(v as number)}
              />
              <Tooltip
                formatter={(value) => nf.format(value as number)}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="votesReceived" barSize={28} radius={[6, 6, 0, 0]}>
                {candidates.map((c, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={c.isElected ? "#0F62FE" : "#94A3B8"}
                  />
                ))}
                <LabelList
                  dataKey="votesReceived"
                  position="top"
                  formatter={(label: React.ReactNode) => {
                    const v =
                      typeof label === "number" ? label : Number(label ?? 0);
                    return v > 0 ? nf.format(v) : "";
                  }}
                  style={{ fontSize: 11, fill: "#0F172A", fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
      {/* Trợ lý giải thích kết quả */}
      <ResultAssistant
        summary={{
          totalVotes,
          totalValid,
          totalInvalid,
          candidates: candidates.map((c) => ({
            name: c.name,
            votes: c.votesReceived,
            isElected: c.isElected,
          })),
        }}
      />

    </div>
  );
};

export default Results;
