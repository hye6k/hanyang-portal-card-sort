// 회의 후 카드 목록·설명·버전을 함께 갱신한다. live 전환 전 예비 진행이 필요하다.
export const study = {
  version: 'draft-2026-11-12-v1',
  mode: 'pilot',
  title: '포털 메뉴 분류 조사',
  supabaseUrl: 'https://fictqrupfrgcqxgjqepc.supabase.co',
  publishableKey: 'sb_publishable_yUKXBAQYaE-Q24CIjOmdGQ_qLZgeDvv',
  table: 'card_sort_responses',
};

// 임시 24개이다. 설명은 명칭과 제공받은 맥락을 바탕으로 작성한 초안이다.
// 현재 메뉴 경로는 참가자에게 제공하지 않는다.
export const cards = [
  { id: 'current-grades', label: '금학기성적조회', description: '이번 학기에 받은 성적을 확인한다.' },
  { id: 'semester-grades', label: '학기별성적조회', description: '각 학기에 받은 성적을 확인한다.' },
  { id: 'graduation-check', label: '졸업사정조회', description: '졸업에 필요한 조건을 충족했는지 확인한다.' },
  { id: 'required-courses', label: '필수과목이수조회', description: '필수로 들어야 하는 과목의 이수 여부를 확인한다.' },
  { id: 'course-search', label: '교과목조회', description: '개설된 교과목의 정보를 찾아본다.' },
  { id: 'curriculum', label: '교육과정조회', description: '전공 등의 교육과정과 교과목 구성을 확인한다.' },
  { id: 'registered-courses', label: '수강신청내역조회', description: '자신이 수강 신청한 과목 내역을 확인한다.' },
  { id: 'attendance', label: '출석부조회', description: '수업의 출석 기록을 확인한다.' },
  { id: 'course-evaluation', label: '강의평가결과검색', description: '강의에 대한 평가 결과를 찾아본다.' },
  { id: 'leave-of-absence', label: '휴학신청', description: '일정 기간 학업을 쉬기 위한 신청을 한다.' },
  { id: 'department-change', label: '전과신청', description: '소속 학과나 전공을 바꾸기 위한 신청을 한다.' },
  { id: 'major-application', label: '전공신청/포기', description: '전공을 신청하거나 신청한 전공을 포기한다.' },
  { id: 'tuition-bill', label: '등록금고지서출력', description: '납부할 등록금이 적힌 고지서를 출력한다.' },
  { id: 'payment-history', label: '납부금내역조회', description: '이미 납부한 금액과 내역을 확인한다.' },
  { id: 'tuition-installments', label: '등록금분납신청', description: '등록금을 여러 번에 나누어 납부하도록 신청한다.' },
  { id: 'scholarship-history', label: '장학수혜내역조회', description: '자신이 받은 장학금 내역을 확인한다.' },
  { id: 'scholarship-application', label: '기타교내장학신청', description: '학교에서 운영하는 기타 장학금에 지원한다.' },
  { id: 'certificate', label: '포털증명발급(무료)', description: '포털에서 무료로 제공하는 증명서를 발급받는다.' },
  { id: 'password', label: '비밀번호변경', description: '포털 로그인에 사용하는 비밀번호를 변경한다.' },
  { id: 'personal-details', label: '신상정보정정', description: '자신의 신상정보를 확인하고 수정한다.' },
  { id: 'preferences', label: '환경설정', description: '포털 이용 환경과 로그인 추가 인증 등의 설정을 변경한다.' },
  { id: 'extracurricular', label: '비교과 프로그램 신청', description: '정규 교과목 이외의 프로그램에 참여 신청을 한다.' },
  { id: 'learning-counseling', label: '상담신청', description: '학습과 관련한 고민을 상담받기 위해 신청한다.' },
  { id: 'internship', label: '실습기관조회/실습신청', description: '현장실습 기관을 찾아보고 실습을 신청한다.' },
];

export const practiceCards = [
  { id: 'p-apple', label: '사과', description: '연습용 카드이다.' },
  { id: 'p-pencil', label: '연필', description: '연습용 카드이다.' },
  { id: 'p-banana', label: '바나나', description: '연습용 카드이다.' },
  { id: 'p-pen', label: '볼펜', description: '연습용 카드이다.' },
];
