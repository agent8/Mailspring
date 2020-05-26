export default class RESTResult {
  constructor(successful, message, data = null) {
    this.successful = successful;
    this.message = message;
    this.data = data;
  }
}
