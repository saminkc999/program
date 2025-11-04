import React, { type FC, useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign, RotateCcw, X } from "lucide-react";

export type PaymentMethod = "cashapp" | "paypal" | "chime";

type Totals = { cashapp: number; paypal: number; chime: number };

export interface PaymentFormProps {
  initialTotals?: Partial<Totals>;
  onTotalsChange?: (totals: Totals) => void;
  onRecharge?: (payload: {
    amount: number;
    method: PaymentMethod;
    note?: string;
  }) => Promise<void> | void;
  onReset?: () => Promise<Totals> | Totals | void;
}

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const TotalPill: FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    className="rounded-xl border bg-white p-4 shadow-sm"
    style={{ borderColor: color }}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase text-gray-500">
        {label}
      </span>
      <DollarSign className="h-4 w-4" style={{ color }} />
    </div>
    <div className="mt-2 text-2xl font-bold" style={{ color }}>
      {fmtUSD(value)}
    </div>
  </div>
);

const PaymentForm: FC<PaymentFormProps> = ({
  initialTotals,
  onTotalsChange,
  onRecharge,
  onReset,
}) => {
  const [totals, setTotals] = useState<Totals>({
    cashapp: initialTotals?.cashapp ?? 0,
    paypal: initialTotals?.paypal ?? 0,
    chime: initialTotals?.chime ?? 0,
  });

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  const overall = useMemo(
    () => totals.cashapp + totals.paypal + totals.chime,
    [totals]
  );

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cashapp");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // 🟢 ADD PAYMENT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setSubmitting(true);
      setTotals((prev) => ({ ...prev, [method]: prev[method] + amt }));

      await onRecharge?.({
        amount: +amt.toFixed(2),
        method,
        note: note.trim() || undefined,
      });

      setOk(`Added ${fmtUSD(amt)} via ${method}.`);
      setTimeout(() => setOk(null), 3000);

      // ✅ Reset fields after payment is added
      setAmount("");
      setNote("");
      setMethod("cashapp");
    } catch (err: any) {
      setError(err?.message || "Failed to process payment.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  // 🟠 CONFIRM RESET TOTALS
  const handleConfirmReset = async () => {
    try {
      setResetting(true);
      setError(null);
      setOk(null);

      if (onReset) {
        const fresh = (await onReset()) as Totals | void;
        setTotals(fresh || { cashapp: 0, paypal: 0, chime: 0 });
      } else {
        setTotals({ cashapp: 0, paypal: 0, chime: 0 });
      }

      setAmount("");
      setNote("");
      setMethod("cashapp");

      const now = new Date();
      const timeStr = now.toLocaleString();
      setOk(`All payment totals reset successfully ✅ (${timeStr})`);
      setTimeout(() => setOk(null), 3500);
    } catch (e: any) {
      setError(e?.message || "Failed to reset totals.");
      setTimeout(() => setError(null), 3500);
    } finally {
      setResetting(false);
      setShowResetDialog(false);
    }
  };

  const pill = (active: boolean, bg: string, border: string, text: string) =>
    `${
      active
        ? `${bg} ${border} ${text}`
        : "bg-white border-gray-300 text-gray-700"
    } border rounded-lg px-3 py-2 transition flex items-center gap-2`;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-md p-5 space-y-6">
        {/* Totals Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TotalPill
            label="Cash App Total"
            value={totals.cashapp}
            color="rgb(16,185,129)"
          />
          <TotalPill
            label="PayPal Total"
            value={totals.paypal}
            color="rgb(59,130,246)"
          />
          <TotalPill
            label="Chime Total"
            value={totals.chime}
            color="rgb(34,197,94)"
          />
          <TotalPill
            label="All Payments"
            value={overall}
            color="rgb(79,70,229)"
          />
        </div>

        {/* Form Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Add Total Payment
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("cashapp")}
                  className={pill(
                    method === "cashapp",
                    "bg-emerald-50",
                    "border-emerald-300",
                    "text-emerald-700"
                  )}
                >
                  <span className="font-bold text-lg">$</span> Cash&nbsp;App
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("paypal")}
                  className={pill(
                    method === "paypal",
                    "bg-blue-50",
                    "border-blue-300",
                    "text-blue-700"
                  )}
                >
                  <span className="font-semibold text-sm">PP</span> PayPal
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("chime")}
                  className={pill(
                    method === "chime",
                    "bg-green-50",
                    "border-green-300",
                    "text-green-700"
                  )}
                >
                  <span className="font-semibold text-sm">ch</span> Chime
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (USD)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (e.g., 25)"
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500"
                min={0.01}
                step="0.01"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500"
                placeholder="Reference, transaction id, etc."
              />
            </div>

            {/* Alerts */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {ok && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {ok}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add Amount
            </button>

            {/* Reset Totals (open modal) */}
            <button
              type="button"
              onClick={() => setShowResetDialog(true)}
              disabled={submitting || resetting}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Totals
            </button>
          </form>
        </div>
      </div>

      {/* 🧾 MODAL DIALOG for Reset */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative text-center">
            {/* Close Button */}
            <button
              onClick={() => setShowResetDialog(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
              <X size={18} className="text-gray-600" />
            </button>

            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Confirm Reset
            </h2>
            <p className="text-gray-600 mb-6">
              This will clear all payment totals and form fields. Are you sure
              you want to continue?
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex justify-center items-center gap-2 transition disabled:opacity-60"
              >
                {resetting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
                Confirm Reset
              </button>
              <button
                onClick={() => setShowResetDialog(false)}
                className="w-full py-3 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentForm;
