"use client";

import { useState } from "react";

export default function Sample() {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700" htmlFor="sample-in">
        입력
      </label>
      <textarea
        id="sample-in"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-32 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
        placeholder="아무 텍스트나 입력해 보세요"
      />
      <p className="text-sm text-slate-600">글자 수: {text.length}</p>
    </div>
  );
}
