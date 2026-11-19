import {MessageProcessor, basicCatalog, type ActionPayload} from '@a2ui/web_core/v1_0';
import {interactionCatalog} from '@danejw/a2ui-interaction-kit/a2ui/react';

// Register the existing A2UI basic catalog and the interaction extension.
// The host forwards validated user actions to its agent/backend transport.
export function createProcessor(onAction: (action: ActionPayload) => void) {
  return new MessageProcessor([basicCatalog, interactionCatalog], onAction);
}
