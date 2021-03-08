import { ComponentRegistry } from 'mailspring-exports';
import EmailSecurityStatus from './email-security-status';

export function activate() {
  ComponentRegistry.register(EmailSecurityStatus, {
    mode: ['list', 'split'],
    role: 'MessageHeaderStatus',
  });
}

export function deactivate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.unregister(EmailSecurityStatus);
  }
}
