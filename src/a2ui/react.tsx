/** A2UI v1.0 catalog extension. Register alongside basicCatalog(). */
import * as React from 'react';
import {z} from 'zod';
import {createComponentImplementation} from '@a2ui/react';
import {ActionSchema, ChildListSchema, DynamicStringSchema, Catalog} from '@a2ui/web_core/v1_0';
import {InteractiveItem, type ItemCapability, type ItemVariant} from '../react/InteractiveItem.js';

export const INTERACTION_CATALOG_ID = 'https://github.com/Danejw/a2ui-interaction-kit/blob/main/catalog/catalog.json';
const capabilitySchema = z.enum(['expandable', 'dismissible', 'prioritizable', 'selectable', 'actionable']);

/** Props after A2UI binding resolution are passed to the reusable React item. */
export const InteractiveItemComponent = createComponentImplementation({
  name: 'InteractiveItem',
  schema: z.object({
    itemId: DynamicStringSchema,
    title: DynamicStringSchema,
    description: DynamicStringSchema.optional(),
    actionLabel: DynamicStringSchema.optional(),
    capabilities: z.array(capabilitySchema),
    variant: z.enum(['task','approval','notice','incident','report']).optional(),
    status: DynamicStringSchema.optional(),
    metaLabel: DynamicStringSchema.optional(),
    prioritized: z.boolean().optional(),
    selected: z.boolean().optional(),
    children: ChildListSchema.optional(),
    onDismiss: ActionSchema.optional(),
    onPrioritize: ActionSchema.optional(),
    onSelect: ActionSchema.optional(),
    onActivate: ActionSchema.optional(),
    onExpand: ActionSchema.optional(),
  }),
}, ({props, buildChild}) => (
  <InteractiveItem
    itemId={String(props.itemId ?? '')}
    title={String(props.title ?? '')}
    description={props.description == null ? undefined : String(props.description)}
    actionLabel={props.actionLabel == null ? undefined : String(props.actionLabel)}
    capabilities={props.capabilities as ItemCapability[]}
    variant={(props.variant ?? 'task') as ItemVariant}
    status={props.status == null ? undefined : String(props.status)}
    metadata={props.metaLabel == null ? undefined : String(props.metaLabel)}
    prioritized={props.prioritized ?? false}
    selected={props.selected ?? false}
    details={props.children?.map(ref => typeof ref === 'string'
      ? buildChild(ref)
      : buildChild(ref.id, ref.basePath))}
    onDismiss={props.onDismiss}
    onPrioritize={props.onPrioritize}
    onSelect={props.onSelect}
    onActivate={props.onActivate}
    onExpand={props.onExpand}
  />
));

export const interactionCatalog = new Catalog(INTERACTION_CATALOG_ID, '1.0', [InteractiveItemComponent]);
