#!/bin/bash
set -euo pipefail

# Upload ClubOS iOS app to TestFlight
# Usage: ./scripts/upload-testflight.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IOS_DIR="$PROJECT_ROOT/apps/ios"
ARCHIVE_DIR="$IOS_DIR/build/archive"
EXPORT_DIR="$IOS_DIR/build/export"
SCHEME="ClubOS"
PROJECT="$IOS_DIR/ClubOS.xcodeproj"
EXPORT_OPTIONS="$IOS_DIR/ExportOptions.plist"

echo "🏗  ClubOS TestFlight Upload"
echo "================================"

# Clean previous build artifacts
echo ""
echo "1/4  Cleaning previous archives..."
rm -rf "$ARCHIVE_DIR" "$EXPORT_DIR"
mkdir -p "$ARCHIVE_DIR" "$EXPORT_DIR"

# Resolve Swift packages first
echo ""
echo "2/4  Archiving $SCHEME..."
xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_DIR/$SCHEME.xcarchive" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=F2VKRSRXTV \
  | grep -E "^(Archive Succeeded|error:|warning:.*ClubOS|ARCHIVE)" || true

# Check if archive succeeded
if [ ! -d "$ARCHIVE_DIR/$SCHEME.xcarchive" ]; then
  echo "❌ Archive failed. Run without grep to see full output:"
  echo "   xcodebuild archive -project $PROJECT -scheme $SCHEME -configuration Release -archivePath $ARCHIVE_DIR/$SCHEME.xcarchive -destination generic/platform=iOS -allowProvisioningUpdates"
  exit 1
fi
echo "✅ Archive succeeded"

# Export and upload to App Store Connect
echo ""
echo "3/4  Exporting & uploading to App Store Connect..."
EXPORT_OUTPUT=$(xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_DIR/$SCHEME.xcarchive" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates 2>&1)

# Check for success in output
if echo "$EXPORT_OUTPUT" | grep -q "Upload succeeded"; then
  echo "✅ Upload succeeded"
elif [ -f "$EXPORT_DIR/$SCHEME.ipa" ] || [ -f "$EXPORT_DIR/DistributionSummary.plist" ]; then
  echo "✅ Export & upload succeeded"
else
  echo "$EXPORT_OUTPUT" | grep -E "(error:|Upload|Export)" || true
  echo "❌ Export/upload failed. Check output above."
  exit 1
fi

echo ""
echo "4/4  Done!"
echo "================================"
echo "✅ Build uploaded to App Store Connect"
echo "   It will appear in TestFlight within ~15 minutes"
echo "   https://appstoreconnect.apple.com/apps"
