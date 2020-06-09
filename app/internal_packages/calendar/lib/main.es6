import { ComponentRegistry, WorkspaceStore, Actions } from 'mailspring-exports';
import React from 'react';
import CalendarButton from './calendar-button';
import Calendar from './mailprep/app/index';




// Activate is called when the package is loaded. If your package previously
// saved state using `serialize` it is provided.
//

class CalendarWithWindowProps extends React.Component {
  static displayName = 'CalendarWithWindowProps';
  constructor(props) {
    super(props);
  }

  render() {
    return
  }
}

export function activate() {

  if (AppEnv.isMainWindow()) {
    ComponentRegistry.register(CalendarButton, {
      location: WorkspaceStore.Location.RootSidebar,
    });

  } else {
    console.log("HALO")

  }
}

// Serialize is called when your package is about to be unmounted.
// You can return a state object that will be passed back to your package
// when it is re-activated.
//
export function serialize() { }

// This **optional** method is called when the window is shutting down,
// or when your package is being updated or disabled. If your package is
// watching any files, holding external resources, providing commands or
// subscribing to events, release them here.
//
export function deactivate() {
  ComponentRegistry.unregister(CalendarButton);
  ComponentRegistry.unregister(Calendar);
}
