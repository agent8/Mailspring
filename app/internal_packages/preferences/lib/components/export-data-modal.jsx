import React from 'react';
import PropTypes from 'prop-types';
import { AccountStore } from 'mailspring-exports';
import { Menu, RetinaImg, ButtonDropdown } from 'mailspring-component-kit';

const Instructions = ({ onContinue }) => (
  <div className="export-data-modal preferences-modal">
    <RetinaImg
      name={`export-data.png`}
      mode={RetinaImg.Mode.ContentPreserve}
      style={{ width: 200, height: 200 }}
    />
    <h2>Export Your Data</h2>
    <p>
      Edison Mail respects your right to control your data and we protect your privacy, read how. In
      compliance with GDPR regulations, you can export all of the data we collect at any time.
      <br />
      <br />
      <b>Proceed with caution and read all instructions carefully.</b>
    </p>

    <div
      className="modal-button"
      onClick={() => {
        if (onContinue && typeof onContinue === 'function') {
          onContinue();
        }
      }}
    >
      Continue to Export
    </div>
  </div>
);

const StepComponent = ({ stepList, nowStepIndex, setStep }) => {
  const nowStep = stepList[nowStepIndex];
  const nowStepCancelDisable = nowStep.cancelDisable && nowStep.cancelDisable();
  const nowStepConfirmDisable = nowStep.confirmDisable && nowStep.confirmDisable();

  const preStepConfirmDisable = index => {
    const preStep = stepList[index - 1];
    return preStep && preStep.confirmDisable && preStep.confirmDisable();
  };

  const ComponentContent = nowStep.component;

  return (
    <div className="export-data-modal-step">
      <ul>
        <div className="title">EXPORT YOUR DATA</div>
        {stepList.map((step, index) => (
          <li
            className={index === nowStepIndex ? 'active' : ''}
            key={index}
            onClick={() => {
              if (preStepConfirmDisable(index)) {
                return;
              }
              if (setStep && typeof setStep === 'function') {
                setStep(index);
              }
            }}
          >
            {step.title}
          </li>
        ))}
      </ul>
      <div className="component">
        <div className="component-content">
          <ComponentContent />
        </div>
        <div className="button-bar">
          <div
            className={`modal-btn hollow-btn${nowStepCancelDisable ? ' disable' : ''}`}
            onClick={() => {
              if (nowStepCancelDisable) {
                return;
              }
              nowStep.onCancelCB();
            }}
          >
            {nowStep.cancelText}
          </div>
          <div
            className={`modal-btn solid-btn${nowStepConfirmDisable ? ' disable' : ''}`}
            onClick={() => {
              if (nowStepConfirmDisable) {
                return;
              }
              nowStep.onConfirmCB();
            }}
          >
            {nowStep.confirmText}
          </div>
        </div>
      </div>
    </div>
  );
};

const WhatIsInYourData = () => {
  return (
    <div>
      <RetinaImg
        name={`nomail-search-email.png`}
        mode={RetinaImg.Mode.ContentPreserve}
        style={{ width: 200, height: 200 }}
      />
      <h2>What's in your data?</h2>
      <p>
        Information to support smart assistant features like Travel, Packages, Bills & Receipts,
        Entertainment, etc. These smart features help you find things faster, organize your inbox,
        and stay on-time for your next lunch date or travel plans.
      </p>
    </div>
  );
};

const WhereDoWeSendIt = ({ sendEmailAddress, onSelectSendEmail }) => {
  let _dropdownComponent;
  const accountList = AccountStore.accounts();
  const items = accountList.map(account => [account.emailAddress, account.emailAddress]);

  function renderMenuItem([value]) {
    return <span key={value}>{value}</span>;
  }

  function getSelectedMenuItem(items) {
    for (const item of items) {
      const [value] = item;
      if (value === sendEmailAddress) {
        return renderMenuItem(item);
      }
    }
    return renderMenuItem(['Select an email']);
  }

  function onSelectEmail([value, label]) {
    if (onSelectSendEmail && typeof onSelectSendEmail === 'function') {
      onSelectSendEmail(value);
    }
    if (_dropdownComponent && typeof _dropdownComponent.toggleDropdown === 'function') {
      _dropdownComponent.toggleDropdown();
    }
  }

  const menu = (
    <Menu
      items={items}
      itemKey={item => item}
      itemContent={renderMenuItem}
      onSelect={onSelectEmail}
    />
  );

  return (
    <div>
      <RetinaImg
        name={`send-data.png`}
        mode={RetinaImg.Mode.ContentPreserve}
        style={{ width: 200, height: 200 }}
      />
      <h2>Where do we send it?</h2>
      <p>Select the account where you would like to send your zipped data archive.</p>
      <ButtonDropdown
        ref={cm => {
          _dropdownComponent = cm;
        }}
        primaryItem={getSelectedMenuItem(items)}
        menu={menu}
      />
      <div className="modal-notice">
        Your archive contains all your connected email accounts. We recommend not selecting a shared
        inbox, as your archive may contain personal information.
      </div>
    </div>
  );
};

const YourDataArchive = () => {
  // TO DO
  return <div></div>;
};

export default class ExportDataModal extends React.Component {
  static displayName = 'ExportDataModal';

  static propTypes = {
    onConfirmCB: PropTypes.func,
  };

  constructor() {
    super();
    this.state = {
      step: 0,
      listStep: 0,
      sendEmailAddress: '',
      checkedNotice: false,
    };
    this._stepList = [
      {
        title: `What's in your data?`,
        component: () => <WhatIsInYourData />,
        cancelText: 'Back',
        confirmText: 'Next',
        onCancelCB: this._onBack,
        onConfirmCB: this._onNext,
      },
      {
        title: `Where do we send it?`,
        component: () => (
          <WhereDoWeSendIt
            sendEmailAddress={this.state.sendEmailAddress}
            onSelectSendEmail={value => {
              this.setState({ sendEmailAddress: value });
            }}
          />
        ),
        cancelText: 'Back',
        confirmText: 'Next',
        confirmDisable: () => !this.state.sendEmailAddress,
        onCancelCB: this._onBack,
        onConfirmCB: this._onNext,
      },
      {
        title: `Your Data Archive`,
        component: () => <YourDataArchive />,
        cancelText: 'Back',
        confirmText: 'Export My Data',
        confirmDisable: () => !this.state.checkedNotice,
        onCancelCB: this._onBack,
        onConfirmCB: this._onNext,
      },
    ];
  }

  _onBack = () => {
    const { step, listStep } = this.state;
    if (listStep > 0) {
      this.setState({ listStep: listStep - 1 });
    } else if (step > 0) {
      this.setState({ step: step - 1 });
    }
  };

  _onNext = () => {
    const { listStep } = this.state;
    if (listStep + 1 < this._stepList.length) {
      this.setState({ listStep: listStep + 1 });
    } else {
      this._onCompleteStep();
    }
  };

  _onCompleteStep = () => {
    const { onConfirmCB } = this.props;
    if (onConfirmCB && typeof onConfirmCB === 'function') {
      onConfirmCB(this.state.sendEmailAddress);
    }
  };

  _onInstructionsContinue = () => {
    this.setState({ step: 1 });
  };

  _onSetListStep = index => {
    this.setState({ listStep: index });
  };

  _renderModalComponent = () => {
    const { step, listStep } = this.state;
    const renderMap = {
      0: () => <Instructions onContinue={this._onInstructionsContinue} />,
      1: () => (
        <StepComponent
          stepList={this._stepList}
          nowStepIndex={listStep}
          setStep={this._onSetListStep}
        />
      ),
    };
    const NowComponent = renderMap[step];
    return <NowComponent />;
  };

  render() {
    return this._renderModalComponent();
  }
}
