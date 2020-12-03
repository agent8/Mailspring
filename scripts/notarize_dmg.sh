echo "**** start notarize DMG ****"
## 1. 进入目录
cd app/dist
## 2. North认证app
echo "**** start notarize-app ****"
xcrun altool --notarize-app --primary-bundle-id com.edisonmail.edisonmail --username qzs0390@sina.com --file "Email Client for Gmail.dmg" --password rrfj-xffk-fotj-jyup
echo "**** wait 300s ****"
sleep 300
## 3.  把ticket打包到app里
echo "**** start stapler staple ****"
xcrun stapler staple "Email Client for Gmail.dmg"
## 4. 检查
echo "**** start validate app ****"
xcrun stapler validate "Email Client for Gmail.dmg"