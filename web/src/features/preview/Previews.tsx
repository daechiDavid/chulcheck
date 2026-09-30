import type { StudentCard } from "@contract/api.ts";
import { toType1Placeholders, toType21Placeholders, toType22Placeholders, type RequestRow } from "@contract/placeholders.ts";

function Mark({ value }: { value: string }) {
  return <span className="inline-block w-5 text-center font-display">{value || "□"}</span>;
}

export function Type1Preview({
  request,
  student,
  signature,
}: {
  request: RequestRow;
  student: StudentCard;
  signature: string | null;
}) {
  const values = toType1Placeholders(request, { number: student.number, name: student.name, gender: student.gender }, {
    grade: student.grade,
    class_no: student.classNo,
  });
  const rows = [1, 2, 3, 4, 5, 6, 7];
  return (
    <article className="sheet rounded-3xl p-4 text-sm leading-6">
      <h2 className="text-center font-display text-3xl">결석신고서</h2>
      <p className="mt-3 text-center">
        {values.grade}학년 {values.class}반 {values.번호}번 {values.학생명}
      </p>
      <p className="mt-2 text-center">
        {values.sY}년 {values.sM}월 {values.sd}일 ~ {values.eY}년 {values.eM}월 {values.eD}일 ({values.period}일)
      </p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((number) => (
          <li key={number} className="py-2">
            <p>
              <Mark value={values[String(number)]} /> {reasonTitle(number)}
            </p>
            <p className="pl-6 text-muted">{values[`${number}-reason`] || " "}</p>
            {number === 4 ? <p className="pl-6">{values["4-date"]}</p> : null}
            {number === 6 ? (
              <p className="pl-6">
                청첩장 {values["6-r1"] || " "} · 부고장 {values["6-r2"] || " "} · 기타 {values["6-r3"] || " "}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="relative mt-6 text-right">
        {values.yyyy}년 {values.M}월 {values.d}일
        <br />
        보호자 : {values.name}
        <span className="relative ml-2 inline-block">
          (인)
          {signature ? (
            <img src={signature} alt="보호자 서명" className="absolute -left-3 -top-4 h-10 w-20 object-contain" />
          ) : null}
        </span>
      </p>
    </article>
  );
}

export function Type2Preview({
  request,
  student,
  signature,
  report = false,
  reportContent = "",
}: {
  request: RequestRow;
  student: StudentCard;
  signature: string | null;
  report?: boolean;
  reportContent?: string;
}) {
  const classroom = { grade: student.grade, class_no: student.classNo };
  const person = { number: student.number, name: student.name, gender: student.gender };
  const values = report ? toType22Placeholders(request, person, classroom) : toType21Placeholders(request, person, classroom);
  return (
    <article className="sheet rounded-3xl p-4 text-sm leading-6">
      <h2 className="text-center font-display text-3xl">{report ? "교외체험학습 보고서" : "교외체험학습 신청서"}</h2>
      <p className="mt-3">
        {values.grade}학년 {values.class}반 {values.sName} ({values.gender})
      </p>
      <p>
        {values.sY}년 {values.sM}월 {values.sd}일 ~ {values.eY}년 {values.eM}월 {values.ed}일 ({values.period}일)
      </p>
      {report ? (
        <p className="mt-4 min-h-32 whitespace-pre-wrap rounded-xl border border-line bg-white p-3">
          <span className="mb-1 block text-muted">실제 체험 내용</span>
          {reportContent || "작성한 실제 체험 내용이 여기에 표시됩니다."}
        </p>
      ) : (
        <>
          <p className="mt-3">
            <span className="text-muted">장소 </span>
            {values.place}
          </p>
          <p className="mt-2 whitespace-pre-wrap">
            <span className="text-muted">학습 내용 </span>
            {values.reason}
          </p>
          <p className="mt-2 whitespace-pre-wrap">
            <span className="text-muted">학습 계획 </span>
            {values.plan}
          </p>
        </>
      )}
      <p className="relative mt-6 text-right">
        {values.yyyy}년 {values.M}월 {values.d}일
        <br />
        학부모 {values.aName}
        <span className="relative ml-3 inline-block">
          인
          {signature ? (
            <img src={signature} alt="보호자 서명" className="absolute -left-4 -top-4 h-10 w-20 object-contain" />
          ) : null}
        </span>
      </p>
    </article>
  );
}

function reasonTitle(number: number): string {
  return [
    "",
    "질병결석 3일 이상",
    "질병결석 2일 이하 (병·약국)",
    "질병결석 2일 이하 (가정 치료)",
    "미인정결석",
    "법정감염병",
    "경조사",
    "생리결석",
  ][number];
}
