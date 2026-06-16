import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillTeaching } from "@/components/drill/drill-teaching";
import type { DrillItem } from "@/types/drill";

const item: DrillItem = {
  text: "interdisciplinary",
  ipa: "/ˌɪntərˈdɪsəpləneri/",
  phoneme: "ih",
  description: "先慢速听，再跟读目标音。",
};

describe("DrillTeaching", () => {
  it("keeps long standard-audio errors visible before recording starts", () => {
    render(
      <DrillTeaching
        item={item}
        index={0}
        total={5}
        isPlaying={false}
        isLoading={false}
        audioError="无法播放标准发音：本地缓存不可用，网络也暂时不可用。请稍后重试或检查发音音源设置。"
        onPlay={vi.fn()}
        onReady={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "drill-teaching-audio-error");
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");
    expect(alert).toHaveTextContent("无法播放标准发音");
  });
});
