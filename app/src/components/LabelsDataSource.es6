import TableDataSource from './table/table-data-source';

export default class LabelsDataSource extends TableDataSource {
  constructor({ labels = [], keys = [] } = {}) {
    super();
    this._tableData = this._parseLabels(labels, keys);
  }
  _parseLabels(labels, keys) {
    const rows = [];
    const columns = [];
    const numColumns = keys.length;
    for (let i = 0; i < numColumns; i++) {
      columns[i] = [keys[i].displayName || ''];
    }
    labels.forEach(label => {
      const row = [];
      keys.forEach((key, colIndex) => {
        if (label[key.dataKey] !== undefined) {
          let data;
          if (typeof label[key.dataKey] === 'function') {
            data = label[key.dataKey].call(label);
          } else {
            data = label[key.dataKey];
          }
          row.push(data);
        }
      });
      rows.push(row);
    });
    return { rows, columns };
  }
}
