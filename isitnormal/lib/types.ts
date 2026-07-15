export interface OptionStat {
  key: string;
  label: string;
  votes: number;
  pct: number;
}

export interface SurveyStats {
  /** 표본수 */
  n: number;
  /** n>=30일 때만 true. false면 "집계 중"으로 표기 (V3). */
  showStats: boolean;
  options: OptionStat[];
}
