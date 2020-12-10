echo "**** start notarize DMG ****"
## 1. 进入目录
cd app/dist
## 2. North认证app
echo "**** start notarize-app ****"
xcrun altool --notarize-app --primary-bundle-id com.edisonmail.edisonmail --username qzs0390@sina.com --file "Edison Mail.dmg" --password rrfj-xffk-fotj-jyup
echo "**** wait 300s ****"
sleep 300
## 3.  把ticket打包到app里
echo "**** start stapler staple ****"
xcrun stapler staple "Edison Mail.dmg"
## 4. 检查
echo "**** start validate app ****"
xcrun stapler validate "Edison Mail.dmg"