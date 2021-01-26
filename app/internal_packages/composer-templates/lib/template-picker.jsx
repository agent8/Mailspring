import { React, ReactDOM, PropTypes, Actions } from 'mailspring-exports';
import { Menu, RetinaImg, InputSearch } from 'mailspring-component-kit';
import TemplateStore from './template-store';
import TemplateActions from './template-actions';

class TemplatePopover extends React.Component {
  static displayName = 'TemplatePopover';

  static propTypes = {
    messageId: PropTypes.string,
  };

  constructor() {
    super();
    this.state = {
      searchValue: '',
      templates: TemplateStore.getTemplates(),
    };
  }

  componentDidMount() {
    this.unsubscribe = TemplateStore.listen(() => {
      this.setState({ templates: TemplateStore.getTemplates() });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  _filteredTemplates() {
    const { searchValue, templates } = this.state;

    if (!searchValue.length) {
      return templates;
    }

    return templates.filter(t => {
      return t.title.toLowerCase().indexOf(searchValue.toLowerCase()) >= 0;
    });
  }

  _onSearchValueChange = value => {
    this.setState({ searchValue: value });
  };

  _onChooseTemplate = template => {
    TemplateActions.insertTemplateToMessage({
      templateId: template.id,
      messageId: this.props.messageId,
    });
    Actions.closePopover();
  };

  _onManageTemplates = () => {
    TemplateActions.showTemplates();
  };

  _onNewTemplate = () => {
    TemplateActions.createTemplateByMessage({ messageId: this.props.messageId });
  };

  _onClickButton = () => {
    const buttonRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
    Actions.openPopover(this._renderPopover(), { originRect: buttonRect, direction: 'up' });
  };

  render() {
    const filteredTemplates = this._filteredTemplates();

    const headerComponents = [
      <InputSearch
        showPreIcon
        key="InputSearch"
        className="template-picker-input"
        placeholder=""
        onChange={this._onSearchValueChange}
      />,
    ];

    // note: these are using onMouseDown to avoid clearing focus in the composer (I think)
    const footerComponents = [
      <div className="item" key="new" onMouseDown={this._onNewTemplate}>
        Save Draft as Template...
      </div>,
      <div className="item" key="manage" onMouseDown={this._onManageTemplates}>
        Manage Templates...
      </div>,
    ];

    return (
      <Menu
        className="template-picker"
        headerComponents={headerComponents}
        footerComponents={footerComponents}
        items={filteredTemplates}
        itemKey={item => item.id}
        itemContent={item => item.title}
        onSelect={this._onChooseTemplate}
      />
    );
  }
}

class TemplatePicker extends React.Component {
  static displayName = 'TemplatePicker';

  static propTypes = {
    messageId: PropTypes.string,
    session: PropTypes.object,
    draft: PropTypes.object,
  };

  _onClickButton = () => {
    if (this.props.session.isPopout()) {
      Actions.focusHighestLevelDraftWindow(this.props.draft.id, this.props.draft.threadId);
      return;
    }
    const buttonRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
    Actions.openPopover(<TemplatePopover messageId={this.props.messageId} />, {
      originRect: buttonRect,
      direction: 'up',
    });
  };

  render() {
    return (
      <button
        tabIndex={-1}
        className="btn btn-toolbar btn-templates narrow pull-right"
        onClick={this._onClickButton}
        title="Insert quick reply…"
      >
        <RetinaImg
          name="quick-reply.svg"
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
          style={{ width: 24, verticalAlign: 'middle', fontSize: 24 }}
        />
        &nbsp;
        <RetinaImg
          name={'down-arrow.svg'}
          style={{ width: 12, height: 12, fontSize: 12 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    );
  }
}

export default TemplatePicker;
