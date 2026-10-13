#!/bin/bash
# iOS App Store용 IPA 만들기 (서명된 IPA까지만 — 업로드는 하지 않음)
#
# 사용: bash tools/ios-release.sh <빌드번호>     예) bash tools/ios-release.sh 2
#   결과: ios/App/output/App.ipa  (ios/.gitignore의 App/output)
#
# 왜 이렇게 하나 (2026-10-13):
# - 자동 서명 Archive는 개발용 프로필로 서명하는데, 개발용 프로필은 등록된 기기가 있어야 만들어진다.
#   기기 없이도 되도록 서명 없이 Archive → 내보내기(export) 단계에서 배포용으로 서명한다.
# - 그런데 서명 없는 Archive는 entitlements(푸시·App Attest)가 사라져 IPA에 안 들어간다.
#   export는 앱의 기존 서명에 담긴 entitlements를 가져가므로, export 전에 ad-hoc(-) 서명으로
#   entitlements만 붙여 둔다. (배포 인증서는 클라우드 관리라 로컬 codesign에 못 씀)
# - entitlements를 바꾸면 아래 ENT도 같이 바꿀 것 (ios/App/App/App.entitlements와 일치).
# 실행 전: www 변경이 있으면 `npx cap sync ios`. Xcode에 개발자 계정 로그인 필요.
set -euo pipefail
BUILD="${1:?빌드번호를 지정하세요 (App Store Connect에 올린 적 없는 숫자)}"
TEAM=R8D2QANGLK
BUNDLE=com.iconbox.motogarage
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios/App/output"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$ROOT/ios/App"
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$TMP/App.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CURRENT_PROJECT_VERSION="$BUILD" archive -quiet

cat > "$TMP/ent.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>application-identifier</key><string>$TEAM.$BUNDLE</string>
<key>com.apple.developer.team-identifier</key><string>$TEAM</string>
<key>aps-environment</key><string>production</string>
<key>com.apple.developer.devicecheck.appattest-environment</key><string>production</string>
</dict></plist>
EOF
codesign -f -s - --entitlements "$TMP/ent.plist" "$TMP/App.xcarchive/Products/Applications/App.app"

cat > "$TMP/export.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>$TEAM</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>export</string>
<key>uploadSymbols</key><true/>
</dict></plist>
EOF
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
