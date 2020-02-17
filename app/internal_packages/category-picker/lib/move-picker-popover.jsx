/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Menu, LabelColorizer, BoldedSearchResult } from 'mailspring-component-kit';
import {
  Utils,
  Actions,
  TaskQueue,
  CategoryStore,
  Folder,
  SyncbackCategoryTask,
  ChangeLabelsTask,
  FocusedPerspectiveStore,
  TaskFactory,
} from 'mailspring-exports';
import { Categories } from 'mailspring-observables';

export default class MovePickerPopover extends Component {
  static propTypes = {
    threads: PropTypes.array.isRequired,
    account: PropTypes.object.isRequired,
    onCreate: PropTypes.func.isRequired,
    onActionCallback: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this._standardFolders = [];
    this._userCategories = [];
    this.state = this._recalculateState(this.props, { searchValue: '' });
  }

  componentDidMount() {
    this._registerObservables();
    document.body.addEventListener('click', this.onBlur);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this._registerObservables(nextProps);
    this.setState(this._recalculateState(nextProps));
  }

  componentWillUnmount() {
    this._unregisterObservables();
    document.body.removeEventListener('click', this.onBlur);
  }

  onCancel = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  };

  onBlur = (e) => {
    const rect = this.container.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      this.onCancel();
    }
  };
  _onActionCallback = data => {
    if (typeof this.props.onActionCallback === 'function') {
      this.props.onActionCallback(data);
    }
  };

  _registerObservables = (props = this.props) => {
    this._unregisterObservables();
    this.disposables = [
      Categories.forAccount(props.account)
        .sort()
        .subscribe(this._onCategoriesChanged),
    ];
  };

  _unregisterObservables = () => {
    if (this.disposables) {
      this.disposables.forEach(disp => disp.dispose());
    }
  };

  _recalculateState = (props = this.props, { searchValue = this.state.searchValue || '' } = {}) => {
    const { threads, account } = props;
    if (threads.length === 0) {
      return { categoryData: [], searchValue };
    }

    const currentCategories = FocusedPerspectiveStore.current().categories() || [];
    const currentCategoryIds = currentCategories.map(c => c.id);
    const viewingAllMail = !currentCategories.find(c => c.role === 'spam' || c.role === 'trash');
    const hidden = account ? ['drafts', 'sent', 'snoozed'] : [];

    if (viewingAllMail) {
      hidden.push('all');
    }

    const categoryData = []
      .concat(this._standardFolders)
      // .concat([{ divider: true, id: 'category-divider' }])
      .concat(this._userCategories)
      .filter(
        cat =>
          // remove categories that are part of the current perspective or locked
          !hidden.includes(cat.role) && !currentCategoryIds.includes(cat.id),
      )
      .filter(cat => Utils.wordSearchRegExp(searchValue).test(cat.displayName))
      .map(cat => {
        if (cat.divider) {
          return cat;
        }
        return {
          id: cat.id,
          category: cat,
          displayName: cat.displayName,
          backgroundColor: LabelColorizer.backgroundColorDark(cat),
        };
      });
    return { categoryData, searchValue };
  };

  _onCategoriesChanged = categories => {
    this._standardFolders = categories.filter(c => c.isStandardCategory());
    this._userCategories = categories.filter(c => !c.isStandardCategory());
    this.setState(this._recalculateState());
  };

  _onEscape = () => {
    Actions.closePopover();
  };

  _onSelectCategory = item => {
    if (this.props.threads.length === 0) {
      return;
    }

    if (item.newCategoryItem) {
      this._onCreateCategory(item);
    } else {
      this._onMoveToCategory(item);
    }
    Actions.popSheet({reason: 'Move-picker-popover:_onSelectCategory'});
    Actions.closePopover();
  };
  onCreate = (data) => {
    if (this.props.onCreate) {
      this.props.onCreate(data, true);
    }
    this.onCancel();
  };

  _onCreateCategory = () => {
    const syncbackTask = SyncbackCategoryTask.forCreating({
      name: this.state.searchValue,
      accountId: this.props.account.id,
    });

    TaskQueue.waitForPerformRemote(syncbackTask).then(finishedTask => {
      if (!finishedTask.created) {
        AppEnv.showErrorDialog({ title: 'Error', message: `Could not create folder.` });
        return;
      }
      this._onMoveToCategory({ category: finishedTask.created });
    });
    Actions.queueTask(syncbackTask);
  };

  _onMoveToCategory = ({ category }) => {
    const { threads } = this.props;
    if(!Array.isArray(threads) || threads.length === 0){
      AppEnv.reportError(new Error('Move folder threads is empty'), {errorData: category}, {grabLogs: true});
      this._onActionCallback(category);
      return;
    }
    let currentCategory = null;
    const currentPerspective = FocusedPerspectiveStore.current();
    const previousFolder = TaskFactory.findPreviousFolder(currentPerspective, threads[0].accountId);
    if(currentPerspective && Array.isArray(threads) && threads.length > 0){
      currentCategory = currentPerspective.categories().find(
        cat => cat.accountId === threads[0].accountId
      );
    }
    const tasks = TaskFactory.tasksForGeneralMoveFolder({threads, source: 'Move to Folder popup', previousFolder, targetCategory: category, sourceCategory: currentCategory});
    if (tasks.length > 0) {
      Actions.queueTasks(tasks);
    } else {
      AppEnv.reportError(new Error(`Move Folder Tasks returned no tasks`), {
          errorData:
            {
              threads,
              source: 'Move to Folder popup',
              previousFolder,
              targetCategory: category,
              sourceCategory: currentCategory,
            },
        },
        { grabLogs: true });
    }
    // if (category.isFolder() || (previousFolder && previousFolder.isFolder())) {
    //   Actions.queueTasks(
    //     TaskFactory.tasksForChangeFolder({
    //       source: 'Category Picker: Move to Category',
    //       threads: threads,
    //       folder: category,
    //       currentPerspective,
    //     }),
    //   );
    // } else {
    //   const all = [];
    //   // let moveFromInbox = false;
    //   // if(currentPerspective){
    //   //   moveFromInbox = currentPerspective.isInbox();
    //   // }
    //   if(previousFolder && previousFolder.isLabel()){
    //     all.push(previousFolder);
    //   }
    //
    //   // if (all.length > 0 && category.role !== 'inbox') {
    //     tasks.push(
    //       new ChangeLabelsTask({
    //         source: 'Category Picker: Move to Label',
    //         labelsToRemove: all,
    //         labelsToAdd: [category],
    //         threads: threads,
    //         previousFolder,
    //       })
    //     );
    //   // }else {
    //   //   tasks.push(
    //   //     new ChangeLabelsTask({
    //   //       source: 'Category Picker: Add Inbox Label',
    //   //       labelsToRemove: [],
    //   //       labelsToAdd: [category],
    //   //       threads: threads,
    //   //       previousFolder,
    //   //     })
    //   //   );
    //   // }
    //   Actions.queueTasks(tasks);
    // }
    this._onActionCallback(category);
  };

  _onSearchValueChange = event => {
    this.setState(this._recalculateState(this.props, { searchValue: event.target.value }));
  };

  _renderCreateNewItem = ({ searchValue }) => {
    const isFolder = CategoryStore.getInboxCategory(this.props.account) && CategoryStore.getInboxCategory(this.props.account).isFolder();
    let displayText = isFolder ? 'New Folder' : 'New Label';
    if (searchValue.length > 0) {
      displayText = `"${searchValue}" (create new)`;
    }
    return (
      <div key="createNew" className="category-item category-create-new" onMouseDown={this.onCreate.bind(this, searchValue)}>
        {displayText}
      </div>
    );
  };

  _renderItem = item => {
    // if (item.divider) {
    //   return <Menu.Item key={item.id} divider={item.divider} />;
    // } else if (item.newCategoryItem) {
    //   return this._renderCreateNewItem(item);
    // }
    return (
      <div key={item.id} className="category-item">
        <div className="category-display-name">
          <BoldedSearchResult value={item.displayName} query={this.state.searchValue || ''} />
        </div>
      </div>
    );
  };
  _renderNewItem = () => {
    return [
      <Menu.Item key={'category-divider'} divider={true} />,
      this._renderCreateNewItem({ searchValue: this.state.searchValue }),
    ];
  };

  render() {
    const headerComponents = [
      <div className="header-text" key="headerText">Move to ...</div>,
      <input
        type="text"
        tabIndex="1"
        key="textfield"
        className="search"
        placeholder={'Search'}
        value={this.state.searchValue}
        onChange={this._onSearchValueChange}
      />,
    ];

    return (
      <div className="category-picker-popover" ref={(el) => this.container = el}>
        <Menu
          headerComponents={headerComponents}
          footerComponents={this._renderNewItem()}
          items={this.state.categoryData}
          itemKey={item => item.id}
          maxHeight={
            (this.state.categoryData.length > 10) * 210 +
            (this.state.categoryData <= 10) * this.state.categoryData.length * 20
          }
          itemContent={this._renderItem}
          onSelect={this._onSelectCategory}
          onEscape={this._onEscape}
          defaultSelectedIndex={this.state.searchValue === '' ? -1 : 0}
        />
      </div>
    );
  }
}