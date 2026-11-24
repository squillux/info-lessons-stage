# 메타데이터 사진 탐정 · AI 인물 사진 만들기 안내

사람이 함께 찍힌 사진 7장을 AI 이미지로 바꿀 수 있어요.
- 만든 그림은 `assets/photos/ai/` 폴더에 아래 **파일 이름** 그대로 저장해요. 가로 4:3, 가로 800픽셀 정도의 jpg면 충분해요.
- 다 넣은 뒤 Claude에게 "AI 사진 넣었어"라고 말하면 페이지의 `AI_SLOT` 목록에 이름을 추가하고 화면을 확인해요.
- 등장인물은 지우(여학생), 민서(여학생), 하준(남학생)이고 모두 가상 인물이에요. 실제 사람과 닮지 않게 만들어요.
- 물병 그림(파란 물병, JW 스티커)은 페이지가 따로 덧붙이므로 그리지 않아도 돼요.

공통 문구 (모든 프롬프트 뒤에 붙이기):
> photorealistic smartphone snapshot, Korean middle school students wearing navy school uniforms (or blue PE uniforms for sports day), natural light, candid, 4:3, no text, no logos, fictional people

| 파일 이름 | 장면 (사진 속 인물) | 프롬프트 |
|---|---|---|
| m_bul.jpg | 경주 불국사, 오전 10시 (지우, 민서) | Two Korean middle school girls taking a cheerful photo in front of the stone stairs of Bulguksa Temple in Gyeongju, spring morning, school field trip |
| m_dabo.jpg | 불국사 다보탑, 오전 10시 반 (민서) | A Korean middle school girl seen from the side, looking up at the Dabotap stone pagoda at Bulguksa Temple, school field trip, morning |
| m_cheom.jpg | 경주 첨성대, 밤 (지우) | A Korean middle school girl from behind, standing in front of the illuminated Cheomseongdae observatory at night, purple and blue lights, school field trip |
| m_start.jpg | 학교 운동장 출발선, 오전 (지우, 하준) | A Korean middle school girl and boy in blue PE uniforms crouching at the start line of a school running track on sports day, other students cheering in the background |
| m_medal.jpg | 학교 운동장 시상, 오전 11시 (하준) | A Korean middle school boy in a blue PE uniform proudly holding up a gold medal on the school field on sports day |
| m_lunch.jpg | 학교 급식실, 점심 (지우, 민서, 하준) | Three Korean middle school students (two girls, one boy) eating lunch from metal school lunch trays at a cafeteria table, smiling |
| m_blossom.jpg | 동네 공원 벚꽃길, 오후 (민서) | A Korean middle school girl in casual clothes walking under cherry blossom trees in a neighborhood park, spring afternoon, seen from behind |

※ 사진 속 인물과 메타데이터(👤 인물)가 맞아야 해요. 예를 들어 m_lunch에는 세 명, m_medal에는 한 명이 나와야 해요.
