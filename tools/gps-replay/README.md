# GPS 원시 로그 재계산

디버그 빌드의 `GpsDebugLog`(RidingService)가 라이딩마다 `files/gpslog/ride_<시작ms>.jsonl`을 남긴다(최근 40개 유지).
같은 주행 데이터로 현재 방식과 개선안(`docs/gps-tracking-research.md`의 P1·P2·P3·P5)을 다시 계산해 비교한다.

## 로그 꺼내기 (테스트폰, 디버그 빌드)
```
adb shell run-as com.iconbox.motogarage ls files/gpslog
adb exec-out run-as com.iconbox.motogarage cat files/gpslog/ride_XXXX.jsonl > ride_XXXX.jsonl
```
원시 좌표가 들어 있으므로 저장소에 커밋하지 말 것(Drive에 보관).

## 실행
```
node tools/gps-replay/replay.mjs ride_XXXX.jsonl [더 많은 파일...]
```
- `current`: 지금 서비스 로직(거리·최고속도 부분)과 같은 계산. 앱에 기록된 거리(`totKm`)와 같아야 정상 — 다르면 이 스크립트가 서비스 로직과 어긋난 것.
- 계산에는 묶음의 마지막 위치만 쓴다(서비스와 동일). 중간 복원(seed)이 있는 기록은 앱 거리와 다를 수 있다.
- 비교 기준은 구글 지도 경로 거리(출발·도착지 같은 경로로 검색)로 잡는다.

## 로그 줄 형식
`{"type":"fix","t":벽시계ms,"et":단조시계ms,"lat","lon","acc","spd"(m/s),"brg","alt","sacc","bacc","mock","prov","bi","bn","posOk","addKm","moving","totKm","recv"}`
그 밖에 `start`(기기·버전), `seed`(프로세스킬 복원 시 시드값), `stop`.
