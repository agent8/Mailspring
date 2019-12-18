#!/bin/bash

APP_FOLDER="app/dist/Edison Mail-mas-x64"
# Name of your app.
APP="Edison Mail"
# The path of your app to sign.
APP_PATH="$APP_FOLDER/Edison Mail.app"
# The path to the location you want to put the signed package.
RESULT_PATH="$APP_FOLDER/$APP.pkg"
# The name of certificates you requested.
APP_KEY="3rd Party Mac Developer Application: Edison Software Inc. (8QY2MN5UJ9)"
INSTALLER_KEY="3rd Party Mac Developer Installer: Edison Software Inc. (8QY2MN5UJ9)"
# The path of your plist files.
CHILD_PLIST="./scripts/mas_plist/child.plist"
PARENT_PLIST="./scripts/mas_plist/parent.plist"
LOGINHELPER_PLIST="./scripts/mas_plist/loginhelper.plist"

FRAMEWORKS_PATH="$APP_PATH/Contents/Frameworks"
echo "****SIGN Start****"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Electron Framework"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Resources/crashpad_handler"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Squirrel.framework/Versions/A/Resources/ShipIt"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libnode.dylib"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$APP_PATH/Contents/Resources/app.asar.unpacked/mailsync"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper.app/Contents/MacOS/$APP Helper"
codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper.app/"
codesign -s "$APP_KEY" -f --entitlements "$LOGINHELPER_PLIST" "$APP_PATH/Contents/Library/LoginItems/$APP Login Helper.app/Contents/MacOS/$APP Login Helper"
codesign -s "$APP_KEY" -f --entitlements "$LOGINHELPER_PLIST" "$APP_PATH/Contents/Library/LoginItems/$APP Login Helper.app/"
codesign -s "$APP_KEY" --deep -f --entitlements "$CHILD_PLIST" "$APP_PATH/Contents/MacOS/$APP"
codesign -s "$APP_KEY" -f --entitlements "$PARENT_PLIST" "$APP_PATH"

productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_KEY" "$RESULT_PATH"

echo "****SIGN Done!****"
echo "****Validate Start****"
xcrun altool --validate-app -t osx -f "$RESULT_PATH" -u qzs0390@sina.com  -p ghak-zlrl-lmbu-feef
echo "****Validate Done****"