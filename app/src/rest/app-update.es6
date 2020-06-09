import axios from 'axios';
import { remote } from 'electron';
import RESTResult from './result-data-format';

export default class AppUpdate {
  constructor(host) {
    this.host = host;
  }

  getUpdateInformation = async () => {
    const url = `${this.host}/api/ota/common/getInfoByVer`;
    const platform = process.platform === 'darwin' ? 'mac' : process.platform;
    const version = remote.getGlobal('application').version;
    const feedURL = `${url}?platform=desktop-${platform}-full&clientVersion=${version}`;
    try {
      const { data } = await axios.get(feedURL);
      if (data && data.data && data.data.info) {
        return new RESTResult(true, '', data.data.info);
      }
      return new RESTResult(false);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  };
}
