import axios from 'axios';

export default class AppUpdate {
  constructor(host) {
    this.host = host;
  }

  getUpdateInformation = async () => {
    const url = `${this.host}/api/ota/common/getInfoByVer`;
    const platform = process.platform === 'darwin' ? 'mac' : process.platform;
    const feedURL = `${url}?platform=desktop-${platform}-full&clientVersion=${1}`;
    console.error('^^^^^^^^^^^^^^');
    console.error(AppEnv);
    console.error('^^^^^^^^^^^^^^');
  };
}
