import assert from 'node:assert/strict';
import {test} from 'node:test';
import Gio from 'gi://Gio';
import {WidgetContext} from '../../src/data/widget-context.ts';

test('WidgetContext preserva identidade, configurações e ação de preferências', () => {
    const settings = new Gio.Settings();
    let opened = false;
    const context = new WidgetContext('uuid', 'nome', settings, () => {opened = true;});

    assert.equal(context.uuid, 'uuid');
    assert.equal(context.name, 'nome');
    assert.equal(context.settings, settings);

    context.openPreferences();

    assert.equal(opened, true);
});
