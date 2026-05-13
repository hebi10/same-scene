export const FEATURE_GROUPS = [
  {
    title: "MVP 1차",
    items: [
      "CameraView 기반 촬영",
      "중앙점, 중앙원, 그리드 가이드",
      "이전 사진 반투명 오버레이",
      "촬영 사진 저장"
    ]
  },
  {
    title: "MVP 2차",
    items: [
      "사진 비율 프리셋: 9:16, 4:5, 1:1, 16:9, 3:4",
      "위치 이동, 회전, 확대/축소, 저장",
      "로컬 편집 메타데이터 저장"
    ]
  },
  {
    title: "MVP 3차",
    items: [
      "여러 편집 사진 선택",
      "여행 클립 템플릿",
      "Reanimated 기반 미리보기 전환",
      "음악 선택과 오디오 미리듣기"
    ]
  },
  {
    title: "후속 내보내기",
    items: [
      "FFmpeg 또는 서버 렌더러 기반 최종 MP4 생성",
      "완성 영상 저장",
      "다른 앱으로 영상 공유"
    ]
  }
] as const;

export type FeatureGroup = (typeof FEATURE_GROUPS)[number];
