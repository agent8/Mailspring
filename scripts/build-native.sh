currentpath=`pwd`
cd ../../telsa
git pull
cd EdisonMailSync
../buildMac/packageBuild.sh archive
cd archive
archive_name=`ls -lt | grep Release | head -n 1 | awk '{print $9}'`
echo $archive_name
cp $archive_name/Products/usr/local/bin/mailsync $currentpath/app/mailsync