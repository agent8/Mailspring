import React, { Component } from "react";
import { Editor, EditorContext, CollapsedEditor, WithEditorActions } from '@atlaskit/editor-core';
import { JSONTransformer } from '@atlaskit/editor-json-transformer';
import { CSSTransitionGroup } from 'react-transition-group';
import { DateUtils } from 'mailspring-exports';
import Modal, { ModalTransition } from '@atlaskit/modal-dialog';
import { makeProvider } from './mention-provider';
const { LottieImg } = require('mailspring-component-kit');

const _renderLoading = width => {
    return <LottieImg
        name="loading-spinner-blue"
        size={{ width, height: width }}
        style={{ margin: 'none', display: 'inline-block' }}
    />
}
const logout = () => {
    AppEnv.config.set(CONFIG_KEY, {});
}
const eventBus = {
    callbacks: {},
    registCallback: (key, cb) => {
        eventBus.callbacks[key] = cb;
    },
    unregistCallback: (key) => {
        eventBus.callbacks[key] = undefined;
    },
    notify: async function (key) {
        const cb = eventBus.callbacks[key];
        if (cb) {
            const args = [...arguments].slice(1);
            await cb(...args);
        }
    }
};
class JiraComment extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value: props.data.body
        };
        this.mentionProvider = makeProvider(props.jira, props.issueKey);
    }
    componentDidMount = async () => {
        this.mounted = true;
    }
    componentWillUnmount = () => {
        this.mounted = false;
    }
    componentWillReceiveProps = (nextProps) => {
        if (this.props.issueKey !== nextProps.issueKey) {
            this.mentionProvider = makeProvider(nextProps.jira, nextProps.issueKey);
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    onSubmit = actions => async editorView => {
        const value = await actions.getValue();
        if (value != null) {
            AppEnv.trackingEvent('Jira-UpdateComment');
            this.safeSetState({
                progress: 'loading'
            });
            const { issueKey, jira, data, findComments } = this.props;
            try {
                await jira.updateComment(issueKey, data.id, value);
            } catch (err) {
                this.safeSetState({
                    progress: 'error'
                });
                if (err.message && err.message.includes('invalid refresh token')) {
                    logout();
                }
                AppEnv.trackingEvent('Jira-UpdateComment-Failed');
                return;
            }
            await findComments(issueKey, true);
            this.safeSetState({
                progress: 'success'
            });
            AppEnv.trackingEvent('Jira-UpdateComment-Success');
        }
        this.hideEditor();
    }
    onChange = actions => editorView => {
        actions.getValue().then(value => {
            if (value != null) {
                this.safeSetState({
                    value
                })
            }
        })
    }
    hideEditor = () => {
        this.safeSetState({
            show: false
        })
    }
    showEditor = () => {
        this.safeSetState({
            show: true
        })
    }
    showDeleteDialog = () => {
        this.safeSetState({
            showDelete: true
        })
    }
    closeDeleteDialog = () => {
        this.safeSetState({
            showDelete: false
        })
    }
    deleteComment = async () => {
        this.closeDeleteDialog();
        const { issueKey, jira, data, findComments } = this.props;
        AppEnv.trackingEvent('Jira-DeleteComment');
        this.safeSetState({
            progress: 'loading'
        });
        try {
            await jira.deleteComment(issueKey, data.id);
        } catch (err) {
            this.safeSetState({
                progress: 'error'
            });
            if (err.message && err.message.includes('invalid refresh token')) {
                logout();
            }
            AppEnv.trackingEvent('Jira-DeleteComment-Failed');
            return;
        }
        await findComments(issueKey, true);
        this.safeSetState({
            progress: 'success'
        });
        AppEnv.trackingEvent('Jira-DeleteComment-Success');
    }
    render() {
        const { html } = this.props;
        const { show, value, progress, showDelete } = this.state;
        const actions = [
            { text: 'Delete', onClick: this.deleteComment },
            { text: 'Cancel', onClick: this.closeDeleteDialog },
        ];
        return <div className="jira-comment-editor-container">
            {
                show ? (
                    <EditorContext>
                        <WithEditorActions
                            render={actions => (
                                <Editor
                                    defaultValue={value}
                                    appearance="comment"
                                    mentionProvider={this.mentionProvider}
                                    onChange={this.onChange(actions)}
                                    onSave={progress !== 'loading' && this.onSubmit(actions)}
                                    onCancel={progress !== 'loading' && this.hideEditor}
                                />
                            )}
                        />
                    </EditorContext>
                ) : <div>
                        <div dangerouslySetInnerHTML={{ __html: html }}></div>
                        <div className="jira-comment-toolbar">
                            <span className="btn edit" onClick={this.showEditor}>Edit</span>
                            <span className="btn delte" onClick={this.showDeleteDialog}>Delete</span>
                        </div>
                    </div>
            }
            {
                progress === 'loading' && <div className="loading">
                    {_renderLoading(20)}
                </div>
            }
            <ModalTransition>
                {
                    showDelete && (
                        <Modal
                            key="active-modal"
                            actions={actions}
                            appearance={'danger'}
                            onClose={this.closeDeleteDialog}
                            heading={`Delete this comment?`}
                        >
                            <div>Once you delete, it's gone for good.</div>
                        </Modal>
                    )
                }
            </ModalTransition>
        </div>
    }
}

export class JiraComments extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    componentDidMount = async () => {
        this.mounted = true;
        eventBus.registCallback('findComments', this.findComments);
        this.safeSetState({
            commentLoading: true
        })
        this.findComments(this.props.issueKey);
    }
    componentWillUnmount = () => {
        this.mounted = false;
        eventBus.unregistCallback('findComments');
    }
    componentWillReceiveProps(nextProps) {
        if (this.props.issueKey !== nextProps.issueKey) {
            this.safeSetState({
                commentLoading: true
            })
            this.findComments(nextProps.issueKey);
        }
    }
    findComments = async (issueKey, shouldTransition) => {
        this.safeSetState({
            shouldTransition
        })
        let rst = await this.props.jira.findComments(issueKey);
        this.safeSetState({
            comments: rst.comments,
            commentLoading: false
        })
    }
    _renderComments = comments => {
        const { commentLoading } = this.state;
        if (commentLoading) {
            return <div>
                {_renderLoading(20)}
            </div>;
        }
        const { renderUserNode, replaceImageSrc } = this.props;
        return (
            <CSSTransitionGroup
                component="div"
                transitionEnterTimeout={350}
                transitionLeaveTimeout={350}
                transitionName={this.state.shouldTransition ? 'transition-slide' : ''}
            >
                {
                    comments.map(item => (
                        <div key={item.id} className="row">
                            <div className="comment-header">
                                {renderUserNode(item.author)}
                                <span className="datetime">{DateUtils.mediumTimeString(item.created)}</span>
                            </div>
                            <JiraComment
                                {...this.props}
                                findComments={this.findComments}
                                data={item}
                                html={replaceImageSrc(item.renderedBody)}
                            />
                        </div>
                    ))
                }
            </CSSTransitionGroup>
        )
    }
    render() {
        const {
            comments = [],
        } = this.state;
        return (
            <div className="jira-comments" onClick={this.props.onClick} >
                <span className="label">Comments</span>
                {this._renderComments(comments)}
            </div>
        )
    }
}

export class CommentSubmit extends Component {
    transformer = new JSONTransformer();
    constructor(props) {
        super(props);
        this.state = {};
        this.mentionProvider = makeProvider(props.jira, props.issueKey);
    }
    componentDidMount = async () => {
        this.mounted = true;
    }
    componentWillUnmount = () => {
        this.mounted = false;
    }
    componentWillReceiveProps = (nextProps) => {
        if (this.props.issueKey !== nextProps.issueKey) {
            this.mentionProvider = makeProvider(nextProps.jira, nextProps.issueKey);
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    expandEditor = () => this.setState({ isExpanded: true });
    collapseEditor = () => this.setState({ isExpanded: false });

    onSave = async (editorView) => {
        /* do something */
        const comment = this.transformer.encode(editorView.state.doc)
        console.log('****data', comment, comment.content.length);
        if (!comment.content || comment.content.length === 0) {
            return;
        }
        AppEnv.trackingEvent('Jira-AddComment');
        try {
            this.safeSetState({
                commentSaving: true
            });
            await this.props.jira.addComment(this.props.issueKey, comment);
            await eventBus.notify('findComments', this.props.issueKey, true);
            AppEnv.trackingEvent('Jira-AddComment-Success');
        } catch (err) {
            console.error('****err', err);
            AppEnv.trackingEvent('Jira-AddComment-Failed');
            if (err.message && err.message.includes('invalid refresh token')) {
                logout();
            }
        }
        this.safeSetState({
            commentSaving: false
        });
        this.collapseEditor();
    };
    render() {
        const { commentSaving } = this.state;
        return (
            <div className="jira-submit-comment">
                <CollapsedEditor
                    placeholder="Add a comment..."
                    isExpanded={this.state.isExpanded}
                    onFocus={this.expandEditor}
                >
                    <Editor
                        shouldFocus
                        appearance="comment"
                        mentionProvider={this.mentionProvider}
                        onSave={!commentSaving && this.onSave}
                        onCancel={!commentSaving && this.collapseEditor}
                    />
                </CollapsedEditor>
                {
                    commentSaving && <div className="loading">
                        {_renderLoading(20)}
                    </div>
                }
            </div>
        )
    }
}