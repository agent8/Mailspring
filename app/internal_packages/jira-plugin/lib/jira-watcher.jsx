import React, { Component } from "react";
import { FixedPopover } from 'mailspring-component-kit';
import { CSSTransitionGroup } from 'react-transition-group';
import Select from 'rc-select';
const { RetinaImg, LottieImg } = require('mailspring-component-kit');
export default class Watcher extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidMount = () => {
        this.mounted = true;
        this.safeSetState({
            loading: true
        })
        this._getWatchers();
    }
    componentWillUnmount = () => {
        this.mounted = false;
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    _getWatchers = async () => {
        const { jira, issueKey } = this.props;
        const watchStatus = await jira.getIssueWatchers(issueKey);
        if (watchStatus) {
            this.safeSetState({
                loading: false,
                watchers: watchStatus.watchers,
                watchCount: watchStatus.watchCount,
                isWatching: watchStatus.isWatching,
            })
        }
    }
    toggleWatching = async () => {
        AppEnv.trackingEvent('Jira-Toggle-Watching');
        let { isWatching, watchCount } = this.state;
        const { jira, currentUser, issueKey } = this.props;
        this.closePopover();
        watchCount = isWatching ? watchCount - 1 : watchCount + 1;
        this.safeSetState({
            progress: 'loading',
            watchCount,
            isWatching: !isWatching
        })
        try {
            if (isWatching) {
                await jira.deleteWatcher(issueKey, currentUser.accountId);
            } else {
                await jira.addWatcher(issueKey, currentUser.accountId);
            }
            this.safeSetState({
                progress: 'success',
            });
            AppEnv.trackingEvent('Jira-Toggle-Watching-Success');
            this._getWatchers();
        } catch (err) {
            AppEnv.trackingEvent('Jira-Toggle-Watching-Failed');
            AppEnv.reportError(new Error(`Toggle watching failed ${issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                progress: 'error',
            })
            return;
        }
    }
    addWatcher = async (item, option) => {
        AppEnv.trackingEvent('Jira-Add-Watcher');
        const { jira, issueKey, currentUser } = this.props;
        const { watchers } = this.state;
        const newWatchers = [...watchers, {
            accountId: item.key,
            displayName: option.props.displayname,
            avatarUrls: option.props.avatarurls
        }]
        this.safeSetState({
            progress: 'loading',
            adding: false,
            watchers: newWatchers,
            watchCount: newWatchers.length,
            isWatching: (item.key === currentUser.accountId)
        })
        try {
            await jira.addWatcher(issueKey, item.key);
            this.safeSetState({
                progress: 'success',
            });
            AppEnv.trackingEvent('Jira-Add-Watcher-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Add-Watcher-Failed');
            AppEnv.reportError(new Error(`Add watcher failed ${issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                progress: 'error',
            })
            return;
        }
    }
    removeWatcher = async accountId => {
        AppEnv.trackingEvent('Jira-Remove-Watcher');
        const { jira, issueKey, currentUser } = this.props;
        const { watchers } = this.state;
        const newWatchers = watchers.filter(item => item.accountId !== accountId);
        this.safeSetState({
            progress: 'loading',
            watchers: newWatchers,
            watchCount: newWatchers.length,
            isWatching: !(accountId === currentUser.accountId)
        })
        try {
            await jira.deleteWatcher(issueKey, accountId);
            this.safeSetState({
                progress: 'success',
            })
            AppEnv.trackingEvent('Jira-Remove-Watcher-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Remove-Watcher-Failed');
            AppEnv.reportError(new Error(`Remove watcher failed ${issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                progress: 'error',
            })
            return;
        }
    }
    _renderLoading(width) {
        return <LottieImg
            name="loading-spinner-blue"
            size={{ width, height: width }}
            style={{ margin: 'none', display: 'inline-block' }}
        />
    }
    _renderProgress = () => {
        const { progress } = this.state;
        if (progress === 'loading') {
            return <div className="loading">
                {this._renderLoading(20)}
            </div>
        }
        return null;
    }
    selectFilter = (inputVal, option) => {
        return option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1;
    }
    _handleClickAddWatcher = () => {
        this.safeSetState({ adding: true });
        setTimeout(() => {
            this.select.openIfHasChildren();
            this.select.inputRef.focus();
            window.sss = this.select;
        }, 300);
    }
    _renderWatcherList = () => {
        const { watchers, isWatching, adding } = this.state;
        const { userOptions } = this.props;
        return <div className="jira-watchlist">
            {this._renderProgress()}
            <div className="row toggle-watch" onClick={this.toggleWatching}>
                <RetinaImg
                    name={!isWatching ? 'jira-watch.svg' : 'jira-not-watch.svg'}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                />
                <span>{isWatching ? 'Stop' : 'Start'} watching</span>
            </div>
            <div className="watcher-list">
                <div className="title">Watching this issue</div>
                <CSSTransitionGroup
                    component="div"
                    transitionEnterTimeout={350}
                    transitionLeaveTimeout={350}
                    transitionName={'transition-fade'}
                >
                    {watchers && watchers
                        .sort((item, next) => next.displayName.localeCompare(item.displayName))
                        .map(item => <div className="row" key={item.accountId}>
                            <span className="jira-user">
                                <img src={item.avatarUrls['24x24']} />
                                <span>{item.displayName}</span>
                            </span>
                            <span className="remove-icon" onClick={() => this.removeWatcher(item.accountId)}>
                                <RetinaImg
                                    name="close.svg"
                                    isIcon
                                    mode={RetinaImg.Mode.ContentIsMask}
                                />
                            </span>
                        </div>)}
                </CSSTransitionGroup>
                {
                    !watchers && <div className="empty">&nbsp;</div>
                }
            </div>
            <div className="add-watcher">
                {
                    !adding ? <div className="row" onClick={this._handleClickAddWatcher}>+ Add watchers</div> :
                        <Select
                            ref={el => this.select = el}
                            placeholder="Add watchers"
                            className="row watch-users"
                            optionLabelProp="children"
                            filterOption={this.selectFilter}
                            labelInValue={true}
                            notFoundContent=""
                            onBlur={() => this.safeSetState({ adding: false })}
                            showSearch={true}
                            onChange={this.addWatcher}
                            dropdownClassName="jira-dropdown"
                        >{userOptions}</Select>
                }
            </div>
        </div>
    }
    openPopover = () => {
        this.safeSetState({
            open: true
        });
        this._getWatchers();
    }
    closePopover = () => {
        this.safeSetState({
            open: false,
            adding: false
        })
    }
    render() {
        const { isWatching, watchCount, loading, open } = this.state;
        const originRect = this.iconRef ? this.iconRef.getBoundingClientRect() : null;
        return (
            <div ref={el => this.iconRef = el} className="jira-watcher">
                <span onClick={this.openPopover}>
                    <RetinaImg
                        name={isWatching ? 'jira-watch.svg' : 'jira-not-watch.svg'}
                        isIcon
                        className={loading ? 'loading' : ''}
                        mode={RetinaImg.Mode.ContentIsMask}
                    />
                    <span>{watchCount > 0 ? watchCount : ''}</span>
                </span>
                {open && originRect && (
                    <FixedPopover {...{
                        className: "jira-watchlist",
                        direction: 'down',
                        disablePointer: true,
                        originRect: {
                            top: 18,
                            left: 160,
                        },
                        closeOnAppBlur: false,
                        onClose: this.closePopover,
                    }}>
                        {this._renderWatcherList()}
                    </FixedPopover>
                )}
            </div>
        )
    }
}