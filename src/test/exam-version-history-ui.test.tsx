import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExamVersionHistoryTable from "@/components/admin/delta-log/ExamVersionHistoryTable";
import SoapVersionDiff from "@/components/admin/delta-log/SoapVersionDiff";
import type { ExamVersionHistoryEntry } from "@/lib/emr-api";

function version(
  overrides: Partial<ExamVersionHistoryEntry> & Pick<ExamVersionHistoryEntry, "id" | "version">
): ExamVersionHistoryEntry {
  return {
    action: "UPDATED",
    actor_name: "Lê Thị Hồng Xoan",
    created_at: "2026-09-16T14:15:00.000Z",
    changed_fields: ["s_text"],
    soap_snapshot: {
      s_text: "Sốt cao",
      o_text: "Ổn",
      a_text: "Sốt chưa rõ nguyên nhân",
      p_text: "Theo dõi",
    },
    is_current: false,
    ...overrides,
  };
}

describe("ExamVersionHistoryTable", () => {
  it("highlights the selected row and shows Đang xem", () => {
    const onSelectVersion = vi.fn();
    const versions = [
      version({ id: "v3", version: 3, is_current: true, action: "UPDATED" }),
      version({
        id: "v2",
        version: 2,
        created_at: "2026-09-16T13:00:00.000Z",
        is_current: false,
      }),
      version({
        id: "v1",
        version: 1,
        action: "AI_GENERATED",
        actor_name: null,
        created_at: "2026-09-16T12:00:00.000Z",
        changed_fields: [],
        is_current: false,
      }),
    ];

    render(
      <ExamVersionHistoryTable
        versions={versions}
        selectedVersion={3}
        onSelectVersion={onSelectVersion}
      />
    );

    expect(screen.getByText("3 phiên bản")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang xem" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Xem chi tiết" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(onSelectVersion).toHaveBeenCalledWith(2);
  });
});

describe("SoapVersionDiff", () => {
  it("only labels the after column as Hiện tại for the current version", () => {
    const current = version({
      id: "v2",
      version: 2,
      is_current: false,
      soap_snapshot: {
        s_text: "Sốt cao",
        o_text: "Ổn",
        a_text: "Sốt chưa rõ nguyên nhân",
        p_text: "Theo dõi",
      },
    });
    const previous = version({
      id: "v1",
      version: 1,
      action: "AI_GENERATED",
      is_current: false,
      soap_snapshot: {
        s_text: "Nhiệt độ cao",
        o_text: "Ổn",
        a_text: "Tình trạng sốt",
        p_text: "Theo dõi",
      },
    });

    const { rerender } = render(
      <SoapVersionDiff currentVersion={current} previousVersion={previous} />
    );

    expect(screen.getByRole("heading", { name: "Chi tiết Phiên bản 2" })).toBeInTheDocument();
    expect(screen.queryByText(/· Hiện tại/)).not.toBeInTheDocument();

    rerender(
      <SoapVersionDiff
        currentVersion={{ ...current, version: 3, is_current: true }}
        previousVersion={previous}
      />
    );

    expect(screen.getByRole("heading", { name: "Chi tiết Phiên bản 3" })).toBeInTheDocument();
    expect(screen.getByText(/Phiên bản 3 · Hiện tại/)).toBeInTheDocument();
  });

  it("shows edited vs unchanged badges for SOAP sections", () => {
    render(
      <SoapVersionDiff
        currentVersion={version({
          id: "v2",
          version: 2,
          is_current: true,
          soap_snapshot: {
            s_text: "Sốt cao",
            o_text: "Ổn",
            a_text: "Sốt chưa rõ nguyên nhân",
            p_text: "Theo dõi",
          },
        })}
        previousVersion={version({
          id: "v1",
          version: 1,
          soap_snapshot: {
            s_text: "Nhiệt độ cao",
            o_text: "Ổn",
            a_text: "Tình trạng sốt",
            p_text: "Theo dõi",
          },
        })}
      />
    );

    expect(screen.getAllByText("Đã chỉnh sửa").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/2 mục đã chỉnh sửa/)).toBeInTheDocument();
  });
});
