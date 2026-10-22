import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChipGroup } from "@/components/app/chips";
import { INTERESTS } from "@/lib/domain/options";

function Harness({ max }: { max?: number }) {
  const [v, setV] = useState<string[]>([]);
  return (
    <>
      <ChipGroup options={INTERESTS.slice(0, 4)} value={v} onChange={setV} max={max} label="관심사" />
      <output>{v.join(",")}</output>
    </>
  );
}

describe("ChipGroup", () => {
  it("토글 + aria-pressed + 최대 개수", async () => {
    const user = userEvent.setup();
    render(<Harness max={2} />);
    const [a, b, c] = screen.getAllByRole("button");
    await user.click(a);
    await user.click(b);
    await user.click(c);
    expect(screen.getByRole("status")).toHaveTextContent("workout,running");
    expect(a).toHaveAttribute("aria-pressed", "true");
    expect(c).toHaveAttribute("aria-pressed", "false");
    await user.click(a);
    expect(screen.getByRole("status")).toHaveTextContent("running");
  });
});
