import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
const catalog = JSON.parse(readFileSync('catalog/catalog.json', 'utf8'));
const surface = JSON.parse(readFileSync('examples/a2ui-surface.json', 'utf8'));
const schema = catalog.components.InteractiveItem;
assert.equal(catalog.protocolVersion, '1.0');
assert.equal(catalog.catalogId, catalog.$id);
assert.equal(surface.version, '1.0');
assert.equal(surface.createSurface.components.find(c => c.id === 'review_item')['@catalogId'], catalog.catalogId);
assert.deepEqual(schema.properties.capabilities.items.enum,
  ['expandable','dismissible','prioritizable','selectable','actionable']);
for (const name of ['onDismiss','onPrioritize','onSelect','onActivate','onExpand']) {
  assert.equal(schema.properties[name].$ref, 'common_types.json#/$defs/Action');
}
console.log('catalog and example structure OK');
