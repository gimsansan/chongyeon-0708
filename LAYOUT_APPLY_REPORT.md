# LAYOUT 반응형·동적 상수 적용 결과 보고서

**작업일:** 2025-03-12  
**대상:** `constants/layout.ts` 기반 반응형 디자인 적용

---

## 1. 적용 완료 파일 (4개)

### 1.1 learn/index.tsx
| 항목 | 적용 전 | 적용 후 |
|------|---------|---------|
| Dimensions | `Dimensions.get('window')` 직접 사용 | `LAYOUT.screenWidth`, `LAYOUT.screenHeight` |
| TAB_BAR_HEIGHT | `56` 하드코딩 | `LAYOUT.tabBarHeight` |
| 섹션/버튼/간격 | `20`, `10`, `25`, `15`, `30`, `50` 등 | `LAYOUT.learnSectionMarginH`, `LAYOUT.spacingMD`, `LAYOUT.learnGameSectionPadding` 등 |
| 난이도 버튼 | `140x140`, `borderRadius: 20` | `LAYOUT.learnDifficultyButtonSize`, `LAYOUT.learnDifficultyButtonBorderRadius` |
| 아이콘/텍스트 | `60`, `32`, `44`, `18` | `LAYOUT.learnStarIconSize`, `LAYOUT.learnMultiStarIconWidth`, `LAYOUT.learnDifficultyNameFontSize` |

**잔여 하드코딩 (색상):**
- `#F0F2F5`, `#333`, `#FFFFFF`, `#F0F0F0`, `#7cbd7e`, `#F9FFF9`, `#444`  
→ 테마/색상 상수로 분리 시 일관성 향상 가능

---

### 1.2 matchGameAI.tsx
| 항목 | 적용 전 | 적용 후 |
|------|---------|---------|
| padding/margin | `20`, `16`, `12`, `8`, `6` 등 | `LAYOUT.spacingMD`, `LAYOUT.spacingSM`, `LAYOUT.spacingXS` |
| fontSize | `28`, `32`, `18`, `20`, `16`, `14` 등 | `LAYOUT.sectionTitleFontSize`, `LAYOUT.buttonTextFontSize`, `LAYOUT.totalCountFontSize` |
| borderRadius | `15`, `12` | `LAYOUT.cardBorderRadius`, `LAYOUT.auditoryStatsCardBorderRadius` |
| 버튼/카드 | `width: '80%'`, `minWidth: 100` | `LAYOUT.auditoryPrimaryButtonWidthPercent`, `LAYOUT.auditoryGameButtonMinWidth` |
| waveAnimation | `200x200` | `LAYOUT.auditoryWaveAnimationSize` |

**잔여 하드코딩 (색상):**
- `#f5f5f5`, `#333`, `#555`, `#666`, `#999`, `#4A90E2`, `#FFFFFF`, `#E0E0E0`, `#E3F2FD`, `#4A90E2`, `#C8E6C9`, `#7cbd7e`, `#FFCDD2`, `#F44336`, `#64748b` 등

---

### 1.3 matchGamePG.tsx
- matchGameAI.tsx와 동일한 스타일 구조 → 동일한 LAYOUT 상수 적용 완료

---

### 1.4 orderGame.tsx
| 항목 | 적용 전 | 적용 후 |
|------|---------|---------|
| 카드/드롭존 | `100x100`, `80x80`, `margin: 10` | `LAYOUT.orderGameCardSize`, `LAYOUT.orderGameImageSize`, `LAYOUT.orderGameDropZoneMargin` |
| 컨테이너 | `padding: 10`, `marginBottom: 20` | `LAYOUT.orderGameImagesContainerPadding`, `LAYOUT.orderGameImagesContainerMarginBottom` |
| 버튼 | `minWidth: 200`, `borderRadius: 15` | `LAYOUT.orderGameStartButtonMinWidth`, `LAYOUT.orderGameStartButtonBorderRadius` |
| waveAnimation | `200x200` | `LAYOUT.auditoryWaveAnimationSize` |

**잔여 하드코딩 (색상):**
- `#fef3c7`, `#f0f0f0`, `#333`, `#10b981`, `#50C878`, `#FFFFFF` 등

---

## 2. layout.ts 추가 상수

```ts
// Learn 탭
tabBarHeight, learnSectionMarginH, learnSectionMarginTop, learnSectionTitleFontSize,
learnDifficultyButtonSize, learnDifficultyButtonBorderRadius, learnDifficultyButtonPadding,
learnDifficultyButtonsGap, learnDifficultyContainerMarginBottom, learnGameSectionPadding,
learnGameContentMarginTop, learnStarIconSize, learnMultiStarIconWidth, learnMultiStarIconHeight,
learnStarsRowContainerHeight, learnDifficultyNameFontSize

// OrderGame
orderGameCardSize, orderGameImageSize, orderGameDropZoneMargin, orderGameDropZoneHeight,
orderGameImagesContainerPadding, orderGameImagesContainerMarginBottom,
orderGameStartButtonMinWidth, orderGameStartButtonBorderRadius, orderGameSubmitButtonMarginTop

// MatchGameAI / MatchGamePG
auditoryWaveAnimationSize, auditoryLoadingTextMarginTop, auditoryGameButtonMinWidth,
auditoryGameButtonMargin, auditoryStatsCardBorderRadius, auditoryStatsCardPadding,
auditoryStatsCardMarginBottom, auditoryOverallStatsValueFontSize, auditoryProgressBarHeight,
auditoryProgressBarBorderRadius, auditoryPrimaryButtonWidthPercent, auditoryStatsBackButtonWidthPercent
```

---

## 3. 기존 적용 파일 검토

### 3.1 add/index.tsx ✅ 양호
- LAYOUT 사용 비율 높음 (progressLine, cardStack, modal, header, spacing 등)
- `sectionMarginH`, `sectionMarginV` 등 하드코딩된 `15`, `10`은 LAYOUT에 이미 반영됨

### 3.2 drum/index.tsx ✅ 양호
- `LAYOUT.drumHeaderTextFontSize`, `LAYOUT.quizBarWidth`, `LAYOUT.quizBarHeight` 적용
- 퀴즈 바 관련 스타일은 LAYOUT 기반

### 3.3 refri-test/index.tsx ✅ 양호
- refri 전용 LAYOUT 상수 대량 사용 (refriRiveWidth, refriAnswerCardWidth 등)
- 구조적으로 잘 정리됨

### 3.4 matchGame.tsx ⚠️ 부분 적용
| 적용됨 | 미적용 (하드코딩) |
|--------|-------------------|
| `LAYOUT.screenWidth`, `LAYOUT.screenHeight` (backgroundContainer) | `startButton`: paddingVertical 18, paddingHorizontal 48, borderRadius 16, minWidth 220 |
| `GRID` (getMatchGameGridMetrics) | `loadingText`: marginTop 20, fontSize 16 |
| | `waveAnimation`: 200x200 |
| | `gameButton`: borderRadius 16, borderWidth 2 |
| | `modalContent`: padding 24, borderRadius 20, fontSize 22/16 |

**권장:** matchGame.tsx의 startButton, loadingText, waveAnimation, modal 관련 스타일을 LAYOUT으로 이전

---

## 4. 잔여 하드코딩 요약

| 구분 | 내용 |
|------|------|
| **색상** | 대부분 파일에 `#333`, `#666`, `#fff` 등 색상 코드 잔존. `constants/colors.ts` 등으로 분리 시 유지보수 용이 |
| **matchGame.tsx** | startButton, modal, loadingText, waveAnimation 등 숫자 하드코딩 |
| **일부 % 값** | `width: '80%'`, `'40%'` 등은 LAYOUT에 `auditoryPrimaryButtonWidthPercent` 등으로 반영 완료 |

---

## 5. 결론

- **4개 파일** (learn, matchGameAI, matchGamePG, orderGame)에 LAYOUT 적용 완료
- **기존 적용 파일** (add, drum, refri-test)는 전반적으로 양호
- **matchGame.tsx**는 추가 LAYOUT 적용 권장
- **색상** 하드코딩은 별도 테마/색상 상수 분리 시 일관성·다크모드 대응에 유리
