import React, { Component } from 'react'

export default class ComposerEditor extends Component {
  constructor (props) {
    super(props)
  }
  render () {
    return (
      <webview
        src='http://0.0.0.0:8080/p/52316330ebe411e9a7be1b757c407294'
        style={{ display: 'inline-flex', height: '600px' }}
      />
    )
  }
}
