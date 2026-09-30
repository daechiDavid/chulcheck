import { useMemo } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ko } from "date-fns/locale";
import "react-day-picker/style.css";
import type { OffDay } from "@contract/api.ts";
import { periodDays } from "@contract/period.ts";
import { fromIso, toIso } from "../../shared/format.ts";

type Props = {
  offDays: OffDay[];
  start: string | null;
  end: string | null;
  minStartDate?: string;
  onChange: (start: string | null, end: string | null) => void;
};

export function DateRangeField({ offDays, start, end, minStartDate, onChange }: Props) {
  const offByDate = useMemo(() => new Map(offDays.map((day) => [day.date, day])), [offDays]);
  const selected: DateRange | undefined = start
    ? { from: fromIso(start), to: end ? fromIso(end) : undefined }
    : undefined;
  const days = start && end ? periodDays(start, end, offByDate.keys()) : null;

  return (
    <div>
      <DayPicker
        mode="range"
        locale={ko}
        selected={selected}
        disabled={minStartDate ? { before: fromIso(minStartDate) } : undefined}
        onSelect={(range) => {
          onChange(range?.from ? toIso(range.from) : null, range?.to ? toIso(range.to) : null);
        }}
        modifiers={{
          off: offDays.map((day) => fromIso(day.date)),
          weekend: { dayOfWeek: [0, 6] },
        }}
        modifiersClassNames={{ off: "day-off", weekend: "day-weekend" }}
        components={{
          DayButton: ({ day, modifiers, ...buttonProps }) => {
            const off = offByDate.get(toIso(day.date));
            return <button {...buttonProps} title={off?.label} data-off={modifiers.off ? "1" : undefined} />;
          },
        }}
      />
      <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
        <div>
          <p className="text-sm text-muted">선택한 기간</p>
          <p className="text-base">
            {start ? start : "시작일"} ~ {end ? end : "종료일"}
          </p>
        </div>
        <p className="font-display text-3xl text-seal">{days == null ? "–" : `${days}일`}</p>
      </div>
      {minStartDate ? (
        <p className="mt-2 text-sm text-muted">체험학습은 실시 전날 16:00까지 신청해야 합니다. 지금 선택할 수 있는 시작일은 {minStartDate}부터입니다.</p>
      ) : (
        <p className="mt-2 text-sm text-muted">토·일·공휴일·재량휴업일은 수업일수에서 빠집니다. 회색 날짜에 커서를 올리면 이름이 보입니다.</p>
      )}
      {days === 0 ? <p className="mt-2 text-sm text-seal">선택한 기간에 수업일이 없습니다.</p> : null}
    </div>
  );
}

export function usePeriod(start: string | null, end: string | null, offDays: OffDay[]): number | null {
  return useMemo(() => {
    if (!start || !end || end < start) return null;
    return periodDays(start, end, offDays.map((day) => day.date));
  }, [start, end, offDays]);
}
