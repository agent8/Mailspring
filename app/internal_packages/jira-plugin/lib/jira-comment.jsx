import React, { Component } from "react";
import { Editor, EditorContext, WithEditorActions } from '@atlaskit/editor-core';

export default class JiraComment extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value: props.data.body
        };
    }
    _onComplete = (some) => {
        // console.log('*****this.ctx', this.ctx, some);
    }
    _onError = (err) => {
        // console.log('*****error', err);
    }
    _rendererContext = (el) => {
        // console.log('******_rendererContext', el);
    }
    onSubmit = actions => editorView => {
        actions.getValue().then(value => {
            if (value != null) {
                console.log('*****value', value);
            }
        })
    }
    onChange = actions => editorView => {
        actions.getValue().then(value => {
            if (value != null) {
                console.log('*****change', value);
                this.setState({
                    value
                })
            }
        })
    }
    hideEditor = () => {
        this.setState({
            show: false
        })
    }
    showEditor = () => {
        this.setState({
            show: true
        })
    }
    render() {
        const { data, html } = this.props;
        const { show, value } = this.state;
        console.log('*****value', value);
        if (show) {
            return <EditorContext>
                <WithEditorActions
                    render={actions => (
                        <Editor
                            defaultValue={value}
                            // value={value}
                            appearance="comment"
                            onChange={this.onChange(actions)}
                            onSave={this.onSubmit(actions)}
                            onCancel={this.hideEditor}
                        />
                    )}
                />
            </EditorContext>
        }
        return <div dangerouslySetInnerHTML={{ __html: html }}></div>
    }
}