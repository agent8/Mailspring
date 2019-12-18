echo "**** start notarize DMG ****"
## 1. 进入目录
cd app/dist
## 2. North认证app
echo "**** start notarize-app ****"
xcrun altool --notarize-app --primary-bundle-id com.easilydo.mac --username qzs0390@sina.com --file "EdisonMail.dmg" --password ghak-zlrl-lmbu-feef
echo "**** wait 300s ****"
sleep 300
## 3.  把ticket打包到app里
echo "**** start stapler staple ****"
xcrun stapler staple EdisonMail.dmg
## 4. 检查
echo "**** start validate app ****"
xcrun stapler validate EdisonMail.dmg