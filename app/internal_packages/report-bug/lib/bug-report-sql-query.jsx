import React, { Component } from 'react';
import _ from 'underscore';
import BugReportStore from './bug-report-store';
import { remote } from 'electron';

export default class BugReportSqlQuery extends Component {
  static displayName = 'BugReportSqlQuery';
  static propTypes = {};
  static defaultProps = {};

  constructor(props) {
    super(props);
    this.state = {
      results: [],
      newQuery: '',
    };
    this._mounted = false;
    this._throttledSubmit = _.throttle(this._sendQuery, 500);
    this._unlisten = [];
  }

  componentDidMount() {
    BugReportStore.resetSqlResults();
    this._mounted = true;
    this._unlisten.push(BugReportStore.listen(this._onStoreUpdate));
  }

  componentWillUnmount() {
    this._mounted = false;
    this._unlisten.map(unsubscribe => unsubscribe());
  }
  _onStoreUpdate = () => {
    if (this._mounted) {
      this.setState({ results: BugReportStore.getSqlResults() });
    }
  };
  _sendQuery = () => {
    BugReportStore.appendSqlQuery(this.state.newQuery.trim());
    this.setState({ newQuery: '' });
  };
  _onSubmitQuery = e => {
    e.preventDefault();
    this._throttledSubmit();
  };
  _onSqlQueryChange = e => {
    if (this._mounted) {
      this.setState({ newQuery: e.target.value });
    }
  };
  renderNewQuery() {
    return (
      <form className="new-query-container" onSubmit={this._onSubmitQuery}>
        <label>Query</label>
        <input value={this.state.newQuery} onChange={this._onSqlQueryChange} />
      </form>
    );
  }
  _onCopy = e => {
    e.preventDefault();
    e.stopPropagation();
    remote.clipboard.writeText(e.currentTarget.innerText);
  };

  renderQueryResult = result => {
    const elapseTime = result.updateTime ? result.updateTime - result.startTime : 0;
    return (
      <div className="result-container">
        <div className="result" onClick={this._onCopy}>
          {result.result}
        </div>
        <div className="elapse-time">{elapseTime}ms</div>
      </div>
    );
  };
  renderResults() {
    if (this.state.results.length > 0) {
      return (
        <div className="results-container">
          {this.renderQueryResult(this.state.results[this.state.results.length - 1])}
        </div>
      );
    } else {
      return null;
    }
  }

  render() {
    return (
      <div className="sql-query-container">
        {this.renderNewQuery()}
        {this.renderResults()}
      </div>
    );
  }
}
