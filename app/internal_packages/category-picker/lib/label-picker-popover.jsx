/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Menu, RetinaImg, LabelColorizer, BoldedSearchResult } from 'mailspring-component-kit';
import {
  Utils,
  Actions,
  Label,
  ChangeLabelsTask,
} from 'mailspring-exports';
import { Categories } from 'mailspring-observables';

export default class LabelPickerPopover extends Component {
  tasks = {};
  static propTypes = {
    threads: PropTypes.array.isRequired,
    account: PropTypes.object.isRequired,
    onActionCallback: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this._labels = [];
    this.state = this._recalculateState(this.props, { searchValue: '' });
  }

  componentDidMount() {
    this._registerObservables();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this._registerObservables(nextProps);
    this.setState(this._recalculateState(nextProps));
  }

  componentWillUnmount() {
    this._unregisterObservables();
  }

  _registerObservables = (props = this.props) => {
    this._unregisterObservables();
    this.disposables = [
      Categories.forAccount(props.account)
        .sort()
        .subscribe(this._onLabelsChanged),
    ];
  };

  _unregisterObservables = () => {
    if (this.disposables) {
      this.disposables.forEach(disp => disp.dispose());
    }
  };

  _recalculateState = (props = this.props, { searchValue = this.state.searchValue || '' } = {}) => {
    const { threads } = props;

    if (threads.length === 0) {
      return { categoryData: [], searchValue };
    }

    const categoryData = this._labels
      .filter(label => Utils.wordSearchRegExp(searchValue).test(label.displayName))
      .map(label => {
        return {
          id: label.id,
          category: label,
          displayName: label.displayName,
          backgroundColor: LabelColorizer.backgroundColorDark(label),
          usage: threads.filter(t => t.categories.find(c => c.id === label.id)).length,
          numThreads: threads.length,
        };
      });

    if (searchValue.length > 0) {
      categoryData.push({
        searchValue: searchValue,
        newCategoryItem: true,
        id: 'category-create-new',
      });
    }
    return { categoryData, searchValue };
  };

  _onLabelsChanged = categories => {
    this._labels = categories.filter(c => {
      return c.isLabel() && !c.role;
    });
    this.setState(this._recalculateState());
  };

  _onEscape = () => {
    Actions.closePopover();
  };

  onCancel = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  };

  _onSelectLabel = item => {
    const { account, threads } = this.props;

    if (threads.length === 0) return;
    if (item.newCategoryItem) {
      if (this.props.onCreate) {
        this.props.onCreate(this.state.searchValue);
      }
      this.onCancel();
    } else if (item.usage === threads.length) {
      const task = new ChangeLabelsTask({
        source: 'Category Picker: Existing Category',
        threads: threads,
        labelsToRemove: [item.category],
        labelsToAdd: [],
      });
      this.tasks[item.category.path] = {
        task,
        action: 'Remove'
      };
      item.usage = 0;
    } else {
      const task = new ChangeLabelsTask({
        source: 'Category Picker: Existing Category',
        threads: threads,
        labelsToRemove: [],
        labelsToAdd: [item.category],
      });
      this.tasks[item.category.path] = {
        task,
        action: 'Add'
      }
      item.usage = threads.length;
    }
  };

  _onApplyChanges = () => {
    if (Object.keys(this.tasks)) {
      const addTasks = [];
      const addedLabels = [];
      const removeTasks = [];
      const removedLabels = [];
      const tasks = this.tasks;
      // get remove label tasks and add label tasks
      for (const k in tasks) {
        if (tasks[k].action === 'Add') {
          addedLabels.push(...tasks[k].task.labelsToAdd);
          addTasks.push(tasks[k].task);
        } else if (tasks[k].action === 'Remove') {
          removeTasks.push(tasks[k].task);
          removedLabels.push(...tasks[k].task.labelsToRemove);
        }
      }
      if (removeTasks.length) {
        Actions.queueTasks(removeTasks);
      }
      if (addTasks.length) {
        Actions.queueTasks(addTasks);
      }
      this._actionCallBack(addedLabels, removedLabels);
    }
    Actions.closePopover();
  };
  _actionCallBack = (addedLabels, removedLabels) => {
    if (typeof this.props.onActionCallback === 'function') {
      this.props.onActionCallback({ addedLabels, removedLabels });
    }
  }

  _onSearchValueChange = event => {
    this.setState(this._recalculateState(this.props, { searchValue: event.target.value }));
  };

  _renderCheckbox = item => {
    const styles = {};
    let checkStatus;
    styles.backgroundColor = item.backgroundColor;

    if (item.usage === 0) {
      checkStatus = <span />;
    } else if (item.usage < item.numThreads) {
      checkStatus = (
        <RetinaImg
          className="check-img dash"
          name="tagging-conflicted.png"
          mode={RetinaImg.Mode.ContentPreserve}
          onClick={() => this._onSelectLabel(item)}
        />
      );
    } else {
      checkStatus = (
        <RetinaImg
          className="check-img check"
          name="tagging-checkmark.png"
          mode={RetinaImg.Mode.ContentPreserve}
          onClick={() => this._onSelectLabel(item)}
        />
      );
    }

    return (
      <div className="check-wrap" style={styles}>
        {checkStatus}
      </div>
    );
  };

  _renderCreateNewItem = ({ searchValue }) => {
    return (
      <div className="category-item category-create-new">
        <RetinaImg
          name={`tag.png`}
          className={`category-create-new-tag`}
          mode={RetinaImg.Mode.ContentIsMask}
        />
        <div className="category-display-name">
          <strong>&ldquo;{searchValue}&rdquo;</strong> (new label)
        </div>
      </div>
    );
  };

  _renderItem = item => {
    if (item.divider) {
      return <Menu.Item key={item.id} divider={item.divider} />;
    } else if (item.newCategoryItem) {
      const { categoryData } = this.state;
      const { searchValue } = item;
      for (const data of categoryData) {
        // if exist in list, don't display [create new]
        if (data.displayName === searchValue) {
          return null;
        }
      }
      return this._renderCreateNewItem(item);
    }

    return (
      <div className="category-item" key={item.id}>
        {this._renderCheckbox(item)}
        <div className="category-display-name">
          <BoldedSearchResult value={item.displayName} query={this.state.searchValue || ''} />
        </div>
      </div>
    );
  };

  render() {
    const { categoryData } = this.state;
    const headerComponents = [
      <div key="headerText" className="header-text">Add label...</div>,
      <input
        type="text"
        tabIndex="1"
        key="textfield"
        className="search"
        placeholder={'Label as...'}
        value={this.state.searchValue}
        onChange={this._onSearchValueChange}
      />,
    ];

    let footerComponents = [
      <div key="footer" className="category-item category-create-new" onClick={this._onApplyChanges}>Save Changes</div>
    ];

    if (!categoryData
      || (categoryData.length === 1 && categoryData[0].id === 'category-create-new')) {
      footerComponents = [];
    }

    return (
      <div className="label-picker-popover">
        <Menu
          headerComponents={headerComponents}
          footerComponents={footerComponents}
          items={this.state.categoryData}
          itemKey={item => item.id}
          itemContent={this._renderItem}
          onSelect={this._onSelectLabel}
          onEscape={this._onEscape}
          defaultSelectedIndex={this.state.searchValue === '' ? -1 : 0}
        />
      </div>
    );
  }
}
