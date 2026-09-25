export interface SystemRestrictionsConfig {
  restrictionsDisabled: boolean; // true = Group Work Mode (10 strikes & 3-minute timeout disabled), false = Strict Focus Mode
  disabledAt?: string | null;
  disabledBy?: string | null;
  reason?: string;
  updatedAt: string;
}
