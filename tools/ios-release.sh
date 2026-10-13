#!/bin/bash
# iOS App Store용 IPA 만들기 (+ 선택적으로 App Store Connect 업로드)
#
# 사용: bash tools/ios-release.sh <빌드번호> [upload]     예) bash tools/ios-release.sh 2 upload
#   결과: ios/App/output/App.ipa  (ios/.gitignore의 App/output)
#   upload를 붙이면 검사 통과 후 같은 Archive를 App Store Connect에 올림(Xcode 로그인 계정 사용).
#   업로드는 심사 제출이 아님 — 처리 후 TestFlight에 나타남. 같은 빌드번호는 다시 못 올림.
#
# 서명 방식 (2026-10-13):
# - Release는 수동 서명: 인증서 "Apple Distribution: CHUL WOO LEE (R8D2QANGLK)"(이 Mac 키체인),
#   프로필 "Ridemate App Store"(2027-10-13 만료), entitlements는 App/App.Release.entitlements(production).
#   Debug는 자동 서명 그대로(개발용 프로필은 등록 기기가 생기면 Xcode가 만듦).
# - 서명 없이 Archive 후 export에서 서명하는 우회는 쓰지 말 것 — Google이 서명한 SDK(Firebase·grpc 등)가
#   업로드 검증("Invalid Signature")에서 막혔다.
# - 첫 실행 때 키체인 접근 창이 뜨면 Mac 로그인 암호 입력 후 "항상 허용".
# - 프로필이 만료되거나 entitlements(capabilities)를 바꾸면 developer.apple.com에서 프로필을 다시 생성할 것.
# 실행 전: www 변경이 있으면 `npx cap sync ios`. Xcode에 개발자 계정 로그인 필요.
set -euo pipefail
BUILD="${1:?빌드번호를 지정하세요 (App Store Connect에 올린 적 없는 숫자)}"
UPLOAD="${2:-}"
TEAM=R8D2QANGLK
BUNDLE=com.iconbox.motogarage
PROFILE="Ridemate App Store"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios/App/output"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$ROOT/ios/App"
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$TMP/App.xcarchive" \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$BUILD" archive -quiet

mkplist() { # $1 = export | upload
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>$TEAM</string>
<key>signingStyle</key><string>manual</string>
<key>signingCertificate</key><string>Apple Distribution</string>
<key>provisioningProfiles</key><dict><key>$BUNDLE</key><string>$PROFILE</string></dict>
<key>destination</key><string>$1</string>
<key>uploadSymbols</key><true/>
</dict></plist>
EOF
}
mkplist export > "$TMP/export.plist"
rm -rf "$OUT"
xcodebuild -exportArchive -archivePath "$TMP/App.xcarchive" -exportPath "$OUT" \
  -exportOptionsPlist "$TMP/export.plist" -allowProvisioningUpdates -quiet

# 확인: 배포 서명 + 푸시·App Attest가 들어갔는지
mkdir "$TMP/ipa" && (cd "$TMP/ipa" && unzip -q "$OUT/App.ipa")
APP="$TMP/ipa/Payload/App.app"
SIG="$(codesign -dvv "$APP" 2>&1)"
[[ "$SIG" == *"Authority=Apple Distribution"* ]] || { echo "❌ 배포 인증서 서명 아님"; exit 1; }
ENTS="$(codesign -d --entitlements :- "$APP" 2>/dev/null)"
for k in aps-environment com.apple.developer.devicecheck.appattest-environment; do
  [[ "$ENTS" == *"$k"* ]] || { echo "❌ entitlement 누락: $k"; exit 1; }
done
echo "✅ $OUT/App.ipa — $(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Info.plist") ($BUILD)"

if [[ "$UPLOAD" == "upload" ]]; then
  mkplist upload > "$TMP/upload.plist"
  xcodebuild -exportArchive -archivePath "$TMP/App.xcarchive" -exportPath "$TMP/upload" \
    -exportOptionsPlist "$TMP/upload.plist" -allowProvisioningUpdates -quiet
  echo "✅ App Store Connect 업로드 완료 — 처리 후 TestFlight에 나타남"
fi
